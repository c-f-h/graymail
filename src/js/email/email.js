'use strict';

var ngModule = angular.module('woEmail');
ngModule.service('email', Email);
module.exports = Email;

var config = require('../app-config').config,
    axe = require('axe-logger'),
    PlainMailer = require('./plainmailer'),
    ImapClient = require('./imap-client');

//
//
// Constants
//
//

var FOLDER_DB_TYPE = 'folders';

var SYNC_TYPE_NEW = 'new';
var SYNC_TYPE_DELETED = 'deleted';
var SYNC_TYPE_MSGS = 'messages';

// well known folders
var FOLDER_TYPE_INBOX = 'Inbox';
var FOLDER_TYPE_SENT = 'Sent';
var FOLDER_TYPE_DRAFTS = 'Drafts';
var FOLDER_TYPE_TRASH = 'Trash';
var FOLDER_TYPE_FLAGGED = 'Flagged';

var MSG_ATTR_UID = 'uid';
var MSG_ATTR_MODSEQ = 'modseq';
var MSG_PART_ATTR_CONTENT = 'content';
var MSG_PART_TYPE_ATTACHMENT = 'attachment';
var MSG_PART_TYPE_TEXT = 'text';
var MSG_PART_TYPE_HTML = 'html';

//
//
// Email Service
//
//

/**
 * High-level data access object that orchestrates everything around the handling of mails:
 * receiving via IMAP, sending via SMTP, MIME parsing, local db persistence
 *
 * @param {Object} devicestorage Handles persistence to the local indexed db
 * @param {Object} mailreader Parses MIME messages received from IMAP
 */
function Email(accountStore, mailreader, dialog, auth, status) {
    this._devicestorage = accountStore;
    this._mailreader = mailreader;
    this._dialog = dialog;
    this._auth = auth;
    this._status = status;
}


//
//
// Public API
//
//


/**
 * Initializes the email dao:
 * - assigns _account
 * - initializes _account.folders with the content from memory
 *
 * @param {String} options.account.emailAddress The user's id
 * @param {String} options.account.realname The user's id
 * @return {Promise}
 * @resolve {Object} keypair
 */
Email.prototype.init = function(options) {
    var self = this;

    self._account = options.account;
    self._account.busy = 0; // >0 triggers the spinner
    self._account.online = false;
    self._account.loggingIn = false;
    self._status.update('Offline');

    // fetch folders from idb
    return self._devicestorage.listItems(FOLDER_DB_TYPE, true).then(function(stored) {
        self._account.folders = stored[0] || [];
        self._initFolders();
    }).then(function() {
        // Handle offline and online gracefully ... arm dom event
        window.addEventListener('online', self.onOnline.bind(self));
        window.addEventListener('offline', self.onOffline.bind(self));
    });
};

/**
 * Opens a folder in IMAP so that we can receive updates for it.
 * Please note that this is a no-op if you try to open the outbox, since it is not an IMAP folder
 * but a virtual folder that only exists on disk.
 *
 * @param {Object} folder The folder to be opened
 */
Email.prototype.openFolder = function(folder) {
    var self = this;
    return self.checkOnline().then(function() {
        if (folder.path !== config.outboxMailboxPath) {
            return self._imapClient.selectMailbox(folder.path);
        }
    });
};

/**
 * Delete a message from IMAP, disk and folder.messages.
 *
 * Please note that this deletes from disk only if you delete from the outbox,
 * since it is not an IMAP folder but a virtual folder that only exists on disk.
 *
 * @param {Object} folder The folder from which to delete the messages
 * @param {Object} message The message that should be deleted
 * @param {Boolean} localOnly Indicated if the message should not be removed from IMAP
 * @return {Promise}
 */
Email.prototype.deleteMessage = function(folder, message, localOnly) {
    var self = this;

    self.busy();

    folder.messages.splice(folder.messages.indexOf(message), 1);

    // delete only locally
    if (localOnly || folder.path === config.outboxMailboxPath) {
        return deleteLocal().then(done, done);
    }

    return self.checkOnline().then(function() {
        // delete from IMAP
        return self._imapDeleteMessage(folder, message.uid);

    }).then(function() {
        return deleteLocal();
    }).then(done, done);

    function deleteLocal() {
        // delete from indexed db
        return self._localDeleteMessage(folder, message.uid);
    }

    function done(err) {
        self.done(); // stop the spinner
        updateUnreadCount(folder); // update the unread count, if necessary

        if (err) {
            folder.messages.unshift(message); // re-add the message to the folder in case of an error
            throw err;
        }
    }
};

/**
 * Updates a message's 'unread' and 'answered' flags
 *
 * Please note if you set flags on disk only if you delete from the outbox,
 * since it is not an IMAP folder but a virtual folder that only exists on disk.
 *
 * @param {Object}  options.folder    Folder which contains the message
 * @param {Object}  options.message   The message that should change flags
 * @param {Boolean} options.localOnly If true, change only in local cache
 * @return {Promise}
 */
Email.prototype.setFlags = function(options) {
    var self = this,
        folder = options.folder,
        message = options.message;

    // no-op if the message if not present anymore (for whatever reason)
    if (folder.messages.indexOf(message) < 0) {
        return Promise.resolve();
    }

    self.busy(); // start the spinner

    // don't do a roundtrip to IMAP,
    // especially if you want to mark outbox messages
    if (options.localOnly || folder.path === config.outboxMailboxPath) {
        return markStorage().then(done, done);
    }

    return self.checkOnline().then(function() {
        // mark a message unread/answered on IMAP
        return self._imapMark({
            folder: folder,
            uid: message.uid,
            unread: message.unread,
            answered: message.answered,
            flagged: message.flagged
        });

    }).then(function() {
        return markStorage();

    }).then(done, done);

    function markStorage() {
        // angular pollutes that data transfer objects with helper properties (e.g. $$hashKey),
        // which we do not want to persist to disk. in order to avoid that, we load the pristine
        // message from disk, change the flags and re-persist it to disk
        return self._localListMessages({
            folder: folder,
            uid: message.uid,
        }).then(function(storedMessages) {
            // set the flags
            var storedMessage = storedMessages[0];

            if (!storedMessage) {
                // the message has been deleted in the meantime
                return;
            }

            storedMessage.unread = message.unread;
            storedMessage.flagged = message.flagged;
            storedMessage.answered = message.answered;
            storedMessage.modseq = message.modseq || storedMessage.modseq;

            // store
            return self._localStoreMessages({
                folder: folder,
                emails: [storedMessage]
            });
        });
    }

    function done(err) {
        self.done(); // stop the spinner
        updateUnreadCount(folder); // update the unread count
        if (err) {
            throw err;
        }
    }
};

/**
 * Moves a message to another folder
 *
 * @param {Object} folder      The origin folder
 * @param {Object} destination The destination folder
 * @param {Object} message     The message that should be moved
 * @return {Promise}
 */
Email.prototype.moveMessage = function(folder, destination, message) {
    var self = this;

    self.busy();
    return self.checkOnline().then(function() {
        folder.messages.splice(folder.messages.indexOf(message), 1);

        // delete from IMAP
        return self._imapMoveMessage({
            folder: folder,
            destination: destination,
            uid: message.uid
        }).catch(function(err) {
            // re-add the message to the folder in case of an error, only makes sense if IMAP errors
            folder.messages.unshift(message);
            done(err);
        });

    }).then(function() {
        // delete from local indexed db, will be synced when new folder is opened
        return self._localDeleteMessage(folder, message.uid);

    }).then(done, done);

    function done(err) {
        self.done(); // stop the spinner
        updateUnreadCount(folder); // update the unread count, if necessary
        if (err) {
            throw err;
        }
    }
};

/**
 * Loads message content for one or more messages. First tries to load from
 * local storage, then fetches from IMAP server.
 *
 * @param {Object} options.messages The messages for which to retrieve the body
 * @param {Object} options.folder   The IMAP folder
 * @param {Boolean} options.notifyNew  If true, calls onIncomingMessage on a new message
 * @return {Promise}
 * @resolve {Object}    The message object that was streamed
 */
Email.prototype.getBody = function(options) {
    var self = this,
        messages = options.messages,
        folder = options.folder;

    messages = messages.filter(function(message) {
        // the message either already has a body or is fetching it right now, so no need to become active here
        return !(message.loadingBody || typeof message.body !== 'undefined');
    });

    if (!messages.length) {
        return Promise.resolve();
    }

    messages.forEach(function(message) {
        message.loadingBody = true;
    });

    self.busy();

    var loadedMessages;

    // load the message from disk
    return self._localListMessages({
        folder: folder,
        uid: _.pluck(messages, MSG_ATTR_UID)
    }).then(function(localMessages) {
        loadedMessages = localMessages;

        // find out which messages are not available on disk (uids not included in disk roundtrip)
        var localUids = _.pluck(localMessages, MSG_ATTR_UID);
        var needsImapFetch = messages.filter(function(msg) {
            return !_.contains(localUids, msg.uid);
        });
        return needsImapFetch;

    }).then(function(needsImapFetch) {
        // get the missing messages from imap

        if (!needsImapFetch.length) {
            // no imap roundtrip needed, we're done
            return loadedMessages;
        }

        // do the imap roundtrip
        return self._fetchMessages({
            messages: needsImapFetch,
            folder: folder
        }).then(function(imapMessages) {
            // add the messages from imap to the loaded messages
            loadedMessages = loadedMessages.concat(imapMessages);

        }).catch(function(err) {
            axe.error('Can not fetch messages from IMAP. Reason: ' + err.message + (err.stack ? ('\n' + err.stack) : ''));

            // stop the loading spinner for those messages we can't fetch
            needsImapFetch.forEach(function(message) {
                message.loadingBody = false;
            });

            // we can't fetch from imap, just continue with what we have
            messages = _.difference(messages, needsImapFetch);
        });

    }).then(function() {
        // enhance dummy messages with content
        messages.forEach(function(message) {
            var loadedMessage = _.findWhere(loadedMessages, {
                uid: message.uid
            });

            // enhance the dummy message with the loaded content
            _.extend(message, loadedMessage);
        });

    }).then(function() {
        // extract the message body
        var jobs = [];

        messages.forEach(function(message) {
            var job = self._extractBody(message).catch(function(err) {
                axe.error('Cannot extract body for message uid ' + message.uid + ' . Reason: ' + err.message + (err.stack ? ('\n' + err.stack) : ''));
            });
            jobs.push(job);
        });

        return Promise.all(jobs);
    }).then(function() {
        done();

        if (options.notifyNew && messages.length) {
            // notify for incoming mail
            self.onIncomingMessage && self.onIncomingMessage(messages);
        }

        return messages;
    }).catch(function(err) {
        done();
        throw err;
    });

    function done() {
        messages.forEach(function(message) {
            message.loadingBody = false;
        });
        self.done();
    }
};

/**
 * Retrieves an attachment matching a body part for a given uid and a folder
 *
 * @param {Object} options.folder The folder where to find the attachment
 * @param {Number} options.uid The uid for the message the attachment body part belongs to
 * @param {Object} options.attachment The attachment body part to fetch and parse from IMAP
 * @return {Promise}
 * @resolve {Object} attachment    The attachment body part that was retrieved and parsed
 */
Email.prototype.getAttachment = function(options) {
    var self = this,
        attachment = options.attachment;

    attachment.busy = true;
    return self._getBodyParts(options.folder, options.uid, [attachment]).then(function(parsedBodyParts) {
        attachment.busy = false;
        // add the content to the original object
        attachment.content = parsedBodyParts[0].content;
        return attachment;

    }).catch(function(err) {
        attachment.busy = false;
        throw err;
    });
};

/**
 * Sends a message in the plain
 *
 * @param {Object} mail The message to be sent
 * @param {Object} options.mailer an instance of the PlainMailer (for tests)
 * @param {Object} options.smtpclient an instance of SmtpClient (for tests)
 */
Email.prototype.sendPlaintext = function(mail, options) {
    // mime encode and send email via smtp
    return this._sendGeneric(mail, options);
};

/**
 * This funtion wraps error handling for sending via PlainMailer and uploading to imap.
 * @param {Object} mail The message to be sent
 * @param {Object} options.mailer an instance of the PlainMailer (for tests)
 * @param {Object} options.smtpclient an instance of SmtpClient (for tests)
 */
Email.prototype._sendGeneric = function(mail, options) {
    var self = this;
    options = options || {};
    self.busy();
    return self.checkOnline().then(function() {
        // get the smtp credentials
        return self._auth.getCredentials();

    }).then(function(credentials) {
        // gmail does not require you to upload to the sent items folder after successful sending, whereas most other providers do
        self.ignoreUploadOnSent = self.checkIgnoreUploadOnSent(credentials.smtp.host);

        // create a new PlainMailer
        var _mailer = (options.mailer || new PlainMailer(credentials.smtp));

        // certificate update retriggers sending after cert update is persisted
        _mailer.onCert = self._auth.handleCertificateUpdate.bind(self._auth, 'smtp', self._sendGeneric.bind(self, mail, options), self._dialog.error);

        // send the email
        return _mailer.send(mail, options);

    }).then(function(rfcText) {
        // try to upload to sent, but we don't actually care if the upload failed or not
        // this should not negatively impact the process of sending
        return self._uploadToSent(rfcText).catch(function() {});

    }).then(done, done);

    function done(err) {
        self.done(); // stop the spinner
        if (err) {
            throw err;
        }
    }
};

/**
 * Synchronizes the outbox's contents from disk to memory.
 * If a message has disappeared from the disk, this method will remove
 * it from folder.messages, and it adds any messages from disk to memory the are not yet in folder.messages
 */
Email.prototype.refreshOutbox = function() {
    var outbox = _.findWhere(this._account.folders, {
        type: config.outboxMailboxType
    });

    return this._localListMessages({
        folder: outbox,
        exactmatch: false
    }).then(function(storedMessages) {
        var storedUids = _.pluck(storedMessages, MSG_ATTR_UID),
            memoryUids = _.pluck(outbox.messages, MSG_ATTR_UID),
            newUids = _.difference(storedUids, memoryUids), // uids of messages that are not yet in memory
            removedUids = _.difference(memoryUids, storedUids); // uids of messages that are no longer stored on the disk

        // add new messages that are not yet in memory
        _.filter(storedMessages, function(msg) {
            return _.contains(newUids, msg.uid);
        }).forEach(function(newMessage) {
            outbox.messages.push(newMessage);
        });

        // remove messages that are no longer on disk, i.e. have been removed/sent/...
        _.filter(outbox.messages, function(msg) {
            return _.contains(removedUids, msg.uid);
        }).forEach(function(removedMessage) {
            var index = outbox.messages.indexOf(removedMessage);
            outbox.messages.splice(index, 1);
        });

        updateUnreadCount(outbox, true); // update the unread count, count all messages
    });
};



//
//
// Event Handlers
//
//


/**
 * This method will try to connect a given instance of the imap client.
 * If the connection attempt was successful, it will update the locally
 * available folders with the newly received IMAP folder listing.
 *
 * @param {Object} imap an instance of the imap-client; for testing purposes only
 */
Email.prototype.connectImap = function(imap) {
    var self = this;

    if (!self.isOnline()) {
        // don't try to connect when navigator is offline
        return Promise.resolve();
    }

    self._account.loggingIn = true;
    self._status.update('Connecting...');

    // init imap/smtp clients
    return self._auth.getCredentials().then(function(credentials) {
        // add the maximum update batch size for imap folders to the imap configuration
        credentials.imap.maxUpdateSize = config.imapUpdateBatchSize;

        // enable multithreaded compression handling
        credentials.imap.compressionWorkerPath = config.workerPath + '/browserbox-compression-worker.min.js';

        self._imapClient = (imap || new ImapClient(credentials.imap));

        self._imapClient.onError = onConnectionError; // connection error handling
        self._imapClient.onCert = self._auth.handleCertificateUpdate.bind(self._auth, 'imap', self.connectImap.bind(self), self._dialog.error); // certificate update handling
        self._imapClient.onSyncUpdate = self._onSyncUpdate.bind(self); // attach sync update handler

    }).then(function() {
        // imap login
        return self._imapClient.login();

    }).catch(function(err) {
        // make sure spinner is turned off on error
        self._account.loggingIn = false;
        self._status.update('Offline');

        throw err;

    }).then(function() {
        self._account.loggingIn = false;
        // init folders
        return self._updateFolders();

    }).then(function() {
        // fill the imap mailboxCache with information we have locally available:
        // - highest locally available moseq (NB! JavaScript can't handle 64 bit uints, so modseq values are strings)
        // - list of locally available uids
        // - highest locally available uid
        // - next expected uid
        var mailboxCache = {};
        self._account.folders.forEach(function(folder) {
            var uids = folder.uids.sort(function(a, b) {
                return a - b;
            });
            var lastUid = uids[uids.length - 1];

            mailboxCache[folder.path] = {
                exists: lastUid,
                uidNext: lastUid + 1,
                uidlist: uids,
                highestModseq: '' + folder.modseq
            };
        });
        self._imapClient.mailboxCache = mailboxCache;

        // set status to online after setting cache to prevent race condition
        self._account.online = true;
        self._status.update('Online');

        // by default, select the inbox (if there is one) after connecting the imap client.
        // this avoids race conditions between the listening imap connection and the one where the work is done
        var inbox = _.findWhere(self._account.folders, {
            type: FOLDER_TYPE_INBOX
        });

        if (!inbox) {
            // if there is no inbox, that's ok, too
            return;
        }

        return self.openFolder(inbox).then(function(info) {
            // HACK: force onSyncUpdate() before we go on
            return self._imapClient._onSelectMailbox(self._imapClient._client, inbox.path, info);

        }).then(function() {
            // set up the imap client to listen for changes in the inbox
            self._imapClient.listenForChanges(inbox.path);
        });
    });

    function onConnectionError(error) {
        axe.error('IMAP connection error, disconnected. Reason: ' +
          error.message + (error.stack ? ('\n' + error.stack) : ''));

        self.tearDownAndReconnect();
    }
};

Email.prototype.tearDownAndReconnect = function() {
    var self = this;

    // clean up the _imapClient object
    self.disconnectImap();

    // only try to reconnect if navigator isn't offline
    if (!self.isOnline()) {
        return;
    }

    axe.debug('Attempting reconnect in ' + config.reconnectInterval / 1000 + ' seconds.');

    setTimeout(function() {
        axe.debug('Reconnecting the IMAP stack');
        // re-init client modules on error
        self.connectImap().catch(function(err) {
            // TODO: display a toast or similar
            axe.error('Connecting to IMAP failed: ' + err.message);
            self.tearDownAndReconnect();
        });
    }, config.reconnectInterval);
};

/**
 * Discard the imap client and PlainMailer
 */
Email.prototype.disconnectImap = function() {
    // logout of imap-client
    // ignore error, because it's not problem if logout fails
    if (this._imapClient) {
        this._imapClient.onError = null;
        this._imapClient.onCert = null;
        this._imapClient.onSyncUpdate = null;

        this._imapClient.stopListeningForChanges(function() {});
        this._imapClient.logout(function() {});

        this._imapClient = null;
    }

    // discard clients
    this._account.online = false;
    this._status.update('Offline');

    return Promise.resolve();
};

/**
 * The are updates in the IMAP folder of the following type
 * - 'new': a list of uids that are newly available
 * - 'deleted': a list of uids that were deleted from IMAP available
 * - 'messages': a list of messages (uid + flags) that where changes are available
 *
 * @param {String} options.type The type of the update
 * @param {String} options.path The mailbox for which updates are available
 * @param {Array} options.list Array containing update information. Number (uid) or mail with Object (uid and flags), respectively
 */
Email.prototype._onSyncUpdate = function(options) {
    var self = this,
        uids = options.list;

    var folder = _.findWhere(self._account.folders, {
        path: options.path
    });

    if (!folder) {
        return; // ignore updates for an unknown folder
    }

    if (options.type === SYNC_TYPE_NEW) {
        // new messages available on imap, add the new uids to the folder

        uids = _.difference(uids, folder.uids); // eliminate duplicates
        var maxUid = folder.uids.length ? Math.max.apply(null, folder.uids) : 0; // find highest uid prior to update

        // add to folder's uids, persist folder
        Array.prototype.push.apply(folder.uids, uids);
        self._localStoreFolders();

        // add dummy messages to the message list
        Array.prototype.push.apply(folder.messages, uids.map(function(uid) {
            return {
                uid: uid
            };
        }));

        if (maxUid) {
            // folder not empty, find and download the 20 newest bodies. Notify for the inbox
            var fetch = _.filter(folder.messages, function(msg) {
                return msg.uid > maxUid;
            }).sort(function(a, b) {
                return a.uid - b.uid;
            }).slice(-20);

            self.getBody({
                folder: folder,
                messages: fetch,
                notifyNew: folder.type === FOLDER_TYPE_INBOX
            }).catch(self._dialog.error);
        }

    } else if (options.type === SYNC_TYPE_DELETED) {
        // messages have been deleted

        folder.uids = _.difference(folder.uids, uids); // remove the uids from the uid list
        uids.forEach(function(uid) {
            var message = _.findWhere(folder.messages, {
                uid: uid
            });

            if (!message) {
                return;
            }

            // delete from local folder only
            self.deleteMessage(folder, message, true).catch(self._dialog.error);
        });
    } else if (options.type === SYNC_TYPE_MSGS) {
        // NB! several possible reasons why this could be called.
        // if a message in the array has uid value and flag array, it had a possible flag update
        uids.forEach(function(changedMsg) {
            if (!changedMsg.uid || !changedMsg.flags) {
                return;
            }

            var message = _.findWhere(folder.messages, {
                uid: changedMsg.uid
            });

            if (!message || !message.bodyParts) {
                return;
            }

            // update unread, answered, modseq to the latest info
            message.answered = changedMsg.flags.indexOf('\\Answered') > -1;
            message.unread = changedMsg.flags.indexOf('\\Seen') === -1;
            message.modseq = changedMsg.modseq;

            self.setFlags({
                folder: folder,
                message: message,
                localOnly: true
            }).then(function() {
                // update the folder's last known modseq if necessary
                var modseq = parseInt(changedMsg.modseq, 10);
                if (modseq > folder.modseq) {
                    folder.modseq = modseq;
                    return self._localStoreFolders();
                }
            }).catch(self._dialog.error);
        });
    }
};


//
//
// Internal API
//
//


/**
 * Updates the folder information from imap (if we're online). Adds/removes folders in account.folders,
 * if we added/removed folder in IMAP. If we have an uninitialized folder that lacks folder.messages,
 * all the locally available messages are loaded from memory.
 */
Email.prototype._updateFolders = function() {
    var self = this;

    self.busy(); // start the spinner

    // fetch list from imap server
    return self._imapClient.listWellKnownFolders().then(function(wellKnownFolders) {
        var foldersChanged = false, // indicates if we need to persist anything to disk
            imapFolders = []; // aggregate all the imap folders

        // initialize the folders to something meaningful if that hasn't already happened
        self._account.folders = self._account.folders || [];

        // smuggle the outbox into the well known folders, which is obv not present on imap
        wellKnownFolders[config.outboxMailboxType] = [{
            name: config.outboxMailboxName,
            type: config.outboxMailboxType,
            path: config.outboxMailboxPath
        }];

        // aggregate all of the imap folders in one place
        for (var folderType in wellKnownFolders) {
            if (wellKnownFolders.hasOwnProperty(folderType) && Array.isArray(wellKnownFolders[folderType])) {
                imapFolders = imapFolders.concat(wellKnownFolders[folderType]);
            }
        }

        // find out all the imap paths that are new/removed
        var imapFolderPaths = _.pluck(imapFolders, 'path'),
            localFolderPaths = _.pluck(self._account.folders, 'path'),
            newFolderPaths = _.difference(imapFolderPaths, localFolderPaths),
            removedFolderPaths = _.difference(localFolderPaths, imapFolderPaths);

        // folders need updating if there are new/removed folders
        foldersChanged = !!newFolderPaths.length || !!removedFolderPaths.length;

        // remove all the remotely deleted folders
        removedFolderPaths.forEach(function(removedPath) {
            self._account.folders.splice(self._account.folders.indexOf(_.findWhere(self._account.folders, {
                path: removedPath
            })), 1);
        });

        // add all the new imap folders
        newFolderPaths.forEach(function(newPath) {
            self._account.folders.push(_.findWhere(imapFolders, {
                path: newPath
            }));
        });

        //
        // by now, all the folders are up to date. now we need to find all the well known folders
        //

        // check for the well known folders to be displayed in the uppermost ui part
        // in that order
        var wellknownTypes = [
            FOLDER_TYPE_INBOX,
            FOLDER_TYPE_SENT,
            config.outboxMailboxType,
            FOLDER_TYPE_DRAFTS,
            FOLDER_TYPE_TRASH,
            FOLDER_TYPE_FLAGGED
        ];

        // make sure the well known folders are detected
        wellknownTypes.forEach(function(mbxType) {
            // check if there is a well known folder of this type
            var wellknownFolder = _.findWhere(self._account.folders, {
                type: mbxType,
                wellknown: true
            });

            if (wellknownFolder) {
                // well known folder found, no need to find a replacement
                return;
            }

            // we have no folder of the respective type marked as wellknown, so find the
            // next best folder of the respective type and flag it as wellknown so that
            // we can display it properly
            wellknownFolder = _.findWhere(self._account.folders, {
                type: mbxType
            });

            if (!wellknownFolder) {
                // no folder of that type, to mark as well known, nothing to do here
                return;
            }

            wellknownFolder.wellknown = true;
            foldersChanged = true;
        });

        // order folders
        self._account.folders.sort(function(a, b) {
            if (a.wellknown && b.wellknown) {
                // well known folders should be ordered like the types in the wellknownTypes array
                return wellknownTypes.indexOf(a.type) - wellknownTypes.indexOf(b.type);
            } else if (a.wellknown && !b.wellknown) {
                // wellknown folders should always appear BEFORE the other folders
                return -1;
            } else if (!a.wellknown && b.wellknown) {
                // non-wellknown folders should always appear AFTER wellknown folders
                return 1;
            } else {
                // non-wellknown folders should be sorted case-insensitive
                return a.path.toLowerCase().localeCompare(b.path.toLowerCase());
            }
        });

        self._initFolders();

        // if folders have not changed, can fill them with messages directly
        if (foldersChanged) {
            return self._localStoreFolders();
        }

    /*}).then(function() {

        var inbox = _.findWhere(self._account.folders, {
            type: FOLDER_TYPE_INBOX
        });
        if (inbox && inbox.messages.length) {
            return self.getBody({
                folder: inbox,
                messages: inbox.messages.slice(-30)
            }).catch(self._dialog.error);
        }*/

    }).then(function() {
        self.done();

    }).catch(function(err) {
        self.done(); // stop the spinner
        throw err;
    });
};

/**
 * Initialize each folder in this._account.folders to sensible defaults.
 */
Email.prototype._initFolders = function() {
    var self = this;

    self._account.folders.forEach(function(folder) {
        folder.modseq = folder.modseq || 0;
        folder.count = folder.count || 0;
        folder.uids = folder.uids || []; // attach an empty uids array to the folder
        folder.uids.sort(function(a, b) {
            return a - b;
        });
        folder.messages = folder.messages || folder.uids.map(function(uid) {
            // fill the messages array with dummy messages, messages will be fetched later
            return {
                uid: uid
            };
        });
    });
};

Email.prototype.busy = function() {
    this._account.busy++;
};

Email.prototype.done = function() {
    if (this._account.busy > 0) {
        this._account.busy--;
    }
};



//
//
// IMAP API
//
//

/**
 * Mark messages as un-/read or un-/answered on IMAP
 *
 * @param {Object} options.folder The folder where to find the message
 * @param {Number} options.uid The uid for which to change the flags
 * @param {Number} options.unread Un-/Read flag
 * @param {Number} options.answered Un-/Answered flag
 */
Email.prototype._imapMark = function(options) {
    var self = this;

    return self.checkOnline().then(function() {
        options.path = options.folder.path;
        return self._imapClient.updateFlags(options);
    });
};

/**
 * If we're in the trash folder or no trash folder is available, this deletes a message from IMAP.
 * Otherwise, it moves a message to the trash folder.
 *
 * @param {Object} folder The folder where to find the message
 * @param {Number} uid The uid of the message
 * @return {Promise}
 */
Email.prototype._imapDeleteMessage = function(folder, uid) {
    var self = this;

    return self.checkOnline().then(function() {
        var trash = _.findWhere(self._account.folders, {
            type: FOLDER_TYPE_TRASH
        });

        // there's no known trash folder to move the mail to or we're in the trash folder, so we can purge the message
        if (!trash || folder === trash) {
            return self._imapClient.deleteMessage({
                path: folder.path,
                uid: uid
            });
        }

        return self._imapMoveMessage({
            folder: folder,
            destination: trash,
            uid: uid
        });
    });
};

/**
 * Move stuff around on the server
 *
 * @param {String} options.folder The folder
 * @param {Number} options.destination The destination folder
 * @param {String} options.uid the message's uid
 * @return {Promise}
 */
Email.prototype._imapMoveMessage = function(options) {
    var self = this;
    return self.checkOnline().then(function() {
        return self._imapClient.moveMessage({
            path: options.folder.path,
            destination: options.destination.path,
            uid: options.uid
        });
    });
};

/**
 * Uploads a built message to a folder
 *
 * @param {Object} options.folder The folder where to find the message
 * @param {String} options.message The rfc2822 compatible raw ASCII e-mail source
 */
Email.prototype._imapUploadMessage = function(options) {
    var self = this;

    return self._imapClient.uploadMessage({
        path: options.folder.path,
        message: options.message
    });
};

/**
 * Fetch messages from IMAP server. Does not check local cache.
 *
 * @param options.messages  The messages for which to fetch the bodies (uid required)
 * @param options.folder    The folder from which to fetch.
 */
Email.prototype._fetchMessages = function(options) {
    var self = this,
        messages = options.messages,
        folder = options.folder;

    return self.checkOnline().then(function() {
        // fetch all the metadata at once
        return self._imapClient.listMessages({
            path: folder.path,
            uids: _.pluck(messages, MSG_ATTR_UID)
        });

    }).then(function(msgs) {
        messages = msgs;
        // displays the clip in the UI if the message contains attachments
        messages.forEach(function(message) {
            message.attachments = message.bodyParts.filter(function(bodyPart) {
                return bodyPart.type === MSG_PART_TYPE_ATTACHMENT;
            });
        });

        // get the bodies from imap (individual roundtrips per msg)
        var jobs = [];

        messages.forEach(function(message) {
            // fetch only the content for non-attachment body parts (signed, text, html, resources referenced from the html)
            var contentParts = message.bodyParts.filter(function(bodyPart) {
                return bodyPart.type !== MSG_PART_TYPE_ATTACHMENT || (bodyPart.type === MSG_PART_TYPE_ATTACHMENT && bodyPart.id);
            });
            var attachmentParts = message.bodyParts.filter(function(bodyPart) {
                return bodyPart.type === MSG_PART_TYPE_ATTACHMENT && !bodyPart.id;
            });

            if (!contentParts.length) {
                return;
            }

            // do the imap roundtrip
            var job = self._getBodyParts(folder, message.uid, contentParts).then(function(parsedBodyParts) {
                // concat parsed bodyparts and the empty attachment parts
                message.bodyParts = parsedBodyParts.concat(attachmentParts);

                // store fetched message
                return self._localStoreMessages({
                    folder: folder,
                    emails: [message]
                });
            }).catch(function(err) {
                // ignore errors with err.hide, throw otherwise
                if (err.hide) {
                    return;
                } else {
                    throw err;
                }
            });

            jobs.push(job);
        });

        return Promise.all(jobs);
    }).then(function() {
        // update the folder's last known modseq if necessary
        var highestModseq = Math.max.apply(null, _.pluck(messages, MSG_ATTR_MODSEQ).map(function(modseq) {
            return parseInt(modseq, 10);
        }));
        if (highestModseq > folder.modseq) {
            folder.modseq = highestModseq;
            return self._localStoreFolders();
        }

    }).then(function() {
        updateUnreadCount(folder); // update the unread count
        return messages;
    });
};

/**
 * Stream an email messsage's body
 * @param {String} options.folder The folder
 * @param {String} options.uid the message's uid
 * @param {Object} options.bodyParts The message parts
 */
Email.prototype._getBodyParts = function(folder, uid, bodyParts) {
    var self = this;
    return self.checkOnline().then(function() {
        return self._imapClient.getBodyParts(folder.path, uid, bodyParts);
    }).then(function() {
        if (bodyParts.filter(function(bodyPart) {
                return !(bodyPart.raw || bodyPart.content);
            }).length) {
            var error = new Error('Can not get the contents of this message. It has already been deleted!');
            error.hide = true;
            throw error;
        }

        return self._parse(bodyParts);
    });
};


//
//
// Local Storage API
//
//

/**
 * persist list of folders in device storage
 * note: the folders in the ui also include the messages array, so let's create a clean array here
 */
Email.prototype._localStoreFolders = function() {
    var folders = this._account.folders.map(function(folder) {
        return {
            name: folder.name,
            path: folder.path,
            type: folder.type,
            modseq: folder.modseq,
            wellknown: !!folder.wellknown,
            uids: folder.uids
        };
    });

    return this._devicestorage.store(folders, FOLDER_DB_TYPE);
};

/**
 * List the locally available items form the indexed db stored under "email_[FOLDER PATH]_[MESSAGE UID]" (if a message was provided),
 * or "email_[FOLDER PATH]", respectively
 *
 * @param {Object} options.folder The folder for which to list the content
 * @param {Object} options.uid A specific uid to look up locally in the folder
 */
Email.prototype._localListMessages = function(options) {
    var query;

    var needsExactMatch = typeof options.exactmatch === 'undefined' ? true : options.exactmatch;

    if (Array.isArray(options.uid)) {
        // batch list
        query = options.uid.map(function(uid) {
            return 'email_' + options.folder.path + (uid ? '_' + uid : '');
        });
    } else {
        // single list
        query = 'email_' + options.folder.path + (options.uid ? '_' + options.uid : '');
    }

    return this._devicestorage.listItems(query, needsExactMatch);
};

/**
 * Stores a bunch of messages to the indexed DB. The messages are stored under "email_[FOLDER PATH]_[MESSAGE UID]"
 *
 * @param {Object} options.folder The folder for which to list the content
 * @param {Array} options.messages The messages to store
 */
Email.prototype._localStoreMessages = function(options) {
    var dbType = 'email_' + options.folder.path;
    return this._devicestorage.storeList(options.emails, dbType);
};

/**
 * Deletes a message from the indexed DB.
 *
 * @param {Object} folder The folder from which to delete
 * @param {Number} uid    The message to delete
 */
Email.prototype._localDeleteMessage = function(folder, uid) {
    var path = folder.path;

    if (!path || !uid) {
        return Promise.reject(new Error('Invalid options!'));
    }

    var dbKey = 'email_' + path + '_' + uid;
    return this._devicestorage.removeList(dbKey);
};


//
//
// Internal Helper Methods
//
//


/**
 * Helper method that extracts a message body from the body parts
 *
 * @param {Object} message DTO
 */
Email.prototype._extractBody = function(message) {
    return Promise.resolve().then(function() {
        // extract the content
        var root = message.bodyParts;

        message.body = _.pluck(filterBodyParts(root, MSG_PART_TYPE_TEXT), MSG_PART_ATTR_CONTENT).join('\n');
        message.attachments = filterBodyParts(root, MSG_PART_TYPE_ATTACHMENT);
        message.html = _.pluck(filterBodyParts(root, MSG_PART_TYPE_HTML), MSG_PART_ATTR_CONTENT).join('\n');

        inlineExternalImages(message);
    });
};

/**
 * Parse an email using the mail reader
 * @param  {Array} bodyParts  The body parts to be passed to the mailreader
 * @return {Promise}
 */
Email.prototype._parse = function(bodyParts) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self._mailreader.parse({bodyParts: bodyParts}, function(err, root) {
            if (err) {
                reject(err);
            } else {
                resolve(root);
            }
        });
    });
};

/**
 * Uploads a message to the sent folder, if necessary.
 * Calls back immediately if ignoreUploadOnSent == true or not sent folder was found.
 *
 * @param {String} message The rfc2822 compatible raw ASCII e-mail source
 */
Email.prototype._uploadToSent = function(message) {
    var self = this;
    self.busy();
    return Promise.resolve().then(function() {
        // upload the sent message to the sent folder if necessary
        var sentFolder = _.findWhere(self._account.folders, {
            type: FOLDER_TYPE_SENT
        });

        // return for wrong usage
        if (self.ignoreUploadOnSent || !sentFolder || !message) {
            return;
        }

        // upload
        return self._imapUploadMessage({
            folder: sentFolder,
            message: message
        });

    }).then(function() {
        self.done();
    }).catch(function(err) {
        self.done();
        throw err;
    });
};

/**
 * Check if the client is online and throw an error if this is not the case.
 */
Email.prototype.checkOnline = function() {
    if (this._account.online) {
        return Promise.resolve();
    } else {
        var err = new Error('Client is currently offline!');
        err.code = 42;
        return Promise.reject(err);
    }
};


//
//
// External Heler Methods
//
//


/**
 * Checks whether we need to upload to the sent folder after sending an email.
 *
 * @param {String} hostname The hostname to check
 * @return {Boolean} true if upload can be ignored, otherwise false
 */
Email.prototype.checkIgnoreUploadOnSent = function(hostname) {
    for (var i = 0; i < config.ignoreUploadOnSentDomains.length; i++) {
        if (config.ignoreUploadOnSentDomains[i].test(hostname)) {
            return true;
        }
    }

    return false;
};


/**
 * Check if the user agent is online.
 */
Email.prototype.isOnline = function() {
    return navigator.onLine;
};

/**
 * Event that is called when the user agent goes online.
 * This create new instances of the imap-client and mailer
 * and connects to the mail server.
 */
Email.prototype.onOnline = function() {
    if (this._account) {
        this.connectImap();
    }
};

/**
 * Event handler that is called when the user agent goes offline.
 */
Email.prototype.onOffline = function() {
    return this.disconnectImap();
};



//
//
// Helper Functions
//
//


/**
 * Updates a folder's unread count:
 * - For the outbox, that's the total number of messages (countAllMessages === true),
 * - For every other folder, it's the number of unread messages (countAllMessages === falsy)
 */
function updateUnreadCount(folder, countAllMessages) {
    folder.count = countAllMessages ? folder.messages.length : _.filter(folder.messages, function(msg) {
        return msg.unread;
    }).length;
}

/**
 * Helper function that recursively traverses the body parts tree. Looks for bodyParts that match the provided type and aggregates them
 *
 * @param {Array} bodyParts The bodyParts array
 * @param {String} type The type to look up
 * @param {undefined} result Leave undefined, only used for recursion
 */
function filterBodyParts(bodyParts, type, result) {
    result = result || [];
    bodyParts.forEach(function(part) {
        if (part.type === type) {
            result.push(part);
        } else if (Array.isArray(part.content)) {
            filterBodyParts(part.content, type, result);
        }
    });
    return result;
}

/**
 * Helper function that looks through the HTML content for <img src="cid:..."> and
 * inlines the images linked internally. Manipulates message.html as a side-effect.
 * If no attachment matching the internal reference is found, or constructing a data
 * uri fails, just remove the source.
 *
 * @param {Object} message DTO
 */
function inlineExternalImages(message) {
    message.html = message.html.replace(/(<img[^>]+\bsrc=['"])cid:([^'">]+)(['"])/ig, function(match, prefix, src, suffix) {
        var localSource = '',
            payload = '';

        var internalReference = _.findWhere(message.attachments, {
            id: src
        });

        if (internalReference) {
            for (var i = 0; i < internalReference.content.byteLength; i++) {
                payload += String.fromCharCode(internalReference.content[i]);
            }

            try {
                localSource = 'data:application/octet-stream;base64,' + btoa(payload); // try to replace the source
            } catch (e) {}
        }

        return prefix + localSource + suffix;
    });
}
