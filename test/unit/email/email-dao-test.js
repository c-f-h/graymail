'use strict';

var mailreader = require('mailreader'),
    ImapClient = require('../../../src/js/email/imap-client'),
    PlainMailer = require('../../../src/js/email/plainmailer'),
    EmailDAO = require('../../../src/js/email/email'),
    DeviceStorageDAO = require('../../../src/js/service/devicestorage'),
    Auth = require('../../../src/js/service/auth'),
    Dialog = require('../../../src/js/util/dialog');


describe('Email DAO unit tests', function() {
    // show the stack trace when an error occurred
    chai.config.includeStack = true;

    // SUT
    var dao;

    // mocks
    var imapClientStub, plainMailerStub, devicestorageStub, parseStub, dialogStub, authStub;

    // config
    var emailAddress, passphrase, asymKeySize, account;

    // test data
    var folders, inboxFolder, sentFolder, draftsFolder, outboxFolder, trashFolder, flaggedFolder, otherFolder, mockKeyPair;

    var $rootScope;
    beforeEach(inject(function(_$rootScope_) {
        $rootScope = _$rootScope_;
        //
        // test data
        //
        emailAddress = 'asdf@asdf.com';
        passphrase = 'asdf';
        asymKeySize = 2048;

        inboxFolder = {
            name: 'Inbox',
            type: 'Inbox',
            path: 'INBOX',
            messages: [],
            uids: [],
            modseq: 123
        };

        sentFolder = {
            name: 'Sent',
            type: 'Sent',
            path: 'SENT',
            messages: [],
            uids: [],
            modseq: 123
        };

        draftsFolder = {
            name: 'Drafts',
            type: 'Drafts',
            path: 'DRAFTS',
            messages: [],
            uids: [],
            modseq: 123
        };

        outboxFolder = {
            name: 'Outbox',
            type: 'Outbox',
            path: 'OUTBOX',
            messages: [],
            uids: [],
            modseq: 123
        };

        trashFolder = {
            name: 'Trash',
            type: 'Trash',
            path: 'TRASH',
            messages: [],
            uids: [],
            modseq: 123
        };

        flaggedFolder = {
            name: 'Flagged',
            type: 'Flagged',
            path: 'FLAGGED',
            messages: [],
            uids: [],
            modseq: 123
        };

        otherFolder = {
            name: 'Other',
            type: 'Other',
            path: 'OTHER',
            messages: [],
            uids: [],
            modseq: 123
        };

        folders = [inboxFolder, outboxFolder, trashFolder, sentFolder, otherFolder];

        account = {
            emailAddress: emailAddress,
            asymKeySize: asymKeySize,
            folders: folders,
            online: true
        };

        mockKeyPair = {
            publicKey: {
                _id: 1234,
                userId: emailAddress,
                publicKey: 'publicpublicpublicpublic'
            },
            privateKey: {
                _id: 1234,
                userId: emailAddress,
                encryptedKey: 'privateprivateprivateprivate'
            }
        };

        //
        // setup the mocks
        //
        imapClientStub = sinon.createStubInstance(ImapClient);
        plainMailerStub = sinon.createStubInstance(PlainMailer);
        parseStub = sinon.stub(mailreader, 'parse');
        devicestorageStub = sinon.createStubInstance(DeviceStorageDAO);
        dialogStub = sinon.createStubInstance(Dialog);
        authStub = sinon.createStubInstance(Auth);

        //
        // setup the SUT
        //
        dao = new EmailDAO(devicestorageStub, mailreader, dialogStub, authStub, $rootScope);
        dao._account = account;
        dao._imapClient = imapClientStub;

        //
        // check configuration
        //
        expect(dao._devicestorage).to.equal(devicestorageStub);
        expect(dao._mailreader).to.equal(mailreader);
    }));

    afterEach(function() {
        mailreader.parse.restore();
    });


    describe('#init', function() {
        beforeEach(function() {
            delete dao._account;
        });

        it('should initialize folders', function() {
            devicestorageStub.listItems.withArgs('folders', true).returns(resolves([
                [inboxFolder]
            ]));

            return dao.init({
                account: account
            }).then(function() {
                expect(devicestorageStub.listItems.calledOnce).to.be.true;
            });
        });
    });

    describe('#openFolder', function() {
        it('should open an imap mailbox', function() {
            imapClientStub.selectMailbox.withArgs(inboxFolder.path).returns(resolves());

            return dao.openFolder(inboxFolder).then(function() {
                expect(imapClientStub.selectMailbox.calledOnce).to.be.true;
            });
        });

        it('should not open the virtual outbox folder in imap', function() {
            return dao.openFolder(outboxFolder).then(function() {
                expect(imapClientStub.selectMailbox.called).to.be.false;
            });
        });

        it('should not do anything in offline mode', function(done) {
            account.online = false;

            dao.openFolder(inboxFolder).catch(function(err) {
                expect(err).to.exist;
                expect(imapClientStub.selectMailbox.called).to.be.false;
                done();
            });
        });
    });

    describe('#refreshOutbox', function() {
        var localListStub, mail;

        beforeEach(function() {
            account.folders = [outboxFolder];
            localListStub = sinon.stub(dao, '_localListMessages');
            mail = {
                uid: 123,
                unread: true
            };
        });

        it('should add messages from disk', function() {
            localListStub.withArgs({
                folder: outboxFolder,
                exactmatch: false
            }).returns(resolves([mail]));

            return dao.refreshOutbox().then(function() {
                expect(outboxFolder.count).to.equal(1);
                expect(outboxFolder.messages).to.contain(mail);
            });
        });

        it('should not add messages from disk', function() {
            outboxFolder.messages = [mail];
            localListStub.withArgs({
                folder: outboxFolder,
                exactmatch: false
            }).returns(resolves([mail]));

            return dao.refreshOutbox().then(function() {
                expect(outboxFolder.count).to.equal(1);
                expect(outboxFolder.messages).to.contain(mail);
            });
        });

        it('should remove messages from memory', function() {
            outboxFolder.messages = [mail];
            localListStub.withArgs({
                folder: outboxFolder,
                exactmatch: false
            }).returns(resolves([]));

            return dao.refreshOutbox().then(function() {
                expect(outboxFolder.count).to.equal(0);
                expect(outboxFolder.messages).to.be.empty;
            });
        });
    });

    describe('#deleteMessage', function() {
        var imapDeleteStub, localDeleteStub, message;

        beforeEach(function() {
            message = {
                uid: 1234
            };
            imapDeleteStub = sinon.stub(dao, '_imapDeleteMessage');
            localDeleteStub = sinon.stub(dao, '_localDeleteMessage');
            inboxFolder.messages = [message];
            outboxFolder.messages = [message];
        });

        it('should delete from imap, local, memory', function() {
            var deleteOpts = {
                folder: inboxFolder,
                uid: message.uid
            };

            imapDeleteStub.withArgs(deleteOpts).returns(resolves());
            localDeleteStub.withArgs(deleteOpts).returns(resolves());

            return dao.deleteMessage({
                folder: inboxFolder,
                message: message
            }).then(function() {
                expect(imapDeleteStub.calledOnce).to.be.true;
                expect(localDeleteStub.calledOnce).to.be.true;
                expect(inboxFolder.messages).to.not.contain(message);
            });
        });

        it('should delete from local, memory', function() {
            var deleteOpts = {
                folder: inboxFolder,
                uid: message.uid
            };

            localDeleteStub.withArgs(deleteOpts).returns(resolves());

            return dao.deleteMessage({
                folder: inboxFolder,
                message: message,
                localOnly: true
            }).then(function() {
                expect(imapDeleteStub.called).to.be.false;
                expect(localDeleteStub.calledOnce).to.be.true;
                expect(inboxFolder.messages).to.not.contain(message);
            });
        });

        it('should delete from outbox from local, memory', function() {
            var deleteOpts = {
                folder: outboxFolder,
                uid: message.uid
            };

            localDeleteStub.withArgs(deleteOpts).returns(resolves());

            return dao.deleteMessage({
                folder: outboxFolder,
                message: message
            }).then(function() {
                expect(imapDeleteStub.called).to.be.false;
                expect(localDeleteStub.calledOnce).to.be.true;
                expect(outboxFolder.messages).to.not.contain(message);
            });
        });

        it('should fail at delete from local', function(done) {
            var deleteOpts = {
                folder: inboxFolder,
                uid: message.uid
            };

            imapDeleteStub.withArgs(deleteOpts).returns(resolves());
            localDeleteStub.withArgs(deleteOpts).returns(rejects({}));

            dao.deleteMessage({
                folder: inboxFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapDeleteStub.calledOnce).to.be.true;
                expect(localDeleteStub.calledOnce).to.be.true;
                expect(inboxFolder.messages).to.contain(message);

                done();
            });
        });

        it('should fail at delete from imap', function(done) {
            var deleteOpts = {
                folder: inboxFolder,
                uid: message.uid
            };

            imapDeleteStub.withArgs(deleteOpts).returns(rejects({}));

            dao.deleteMessage({
                folder: inboxFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapDeleteStub.calledOnce).to.be.true;
                expect(localDeleteStub.called).to.be.false;
                expect(inboxFolder.messages).to.contain(message);

                done();
            });
        });

        it('should fail at delete from imap in offline', function(done) {
            account.online = false;
            dao.deleteMessage({
                folder: inboxFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapDeleteStub.called).to.be.false;
                expect(localDeleteStub.called).to.be.false;
                expect(inboxFolder.messages).to.contain(message);

                done();
            });
        });
    });

    describe('#setFlags', function() {
        var imapMark, localListStub, localStoreStub, message;

        beforeEach(function() {
            message = {
                uid: 1234
            };
            imapMark = sinon.stub(dao, '_imapMark');
            localListStub = sinon.stub(dao, '_localListMessages');
            localStoreStub = sinon.stub(dao, '_localStoreMessages');
            inboxFolder.messages = [message];
            outboxFolder.messages = [message];
        });

        it('should set flags for imap, disk, memory', function() {
            imapMark.withArgs({
                folder: inboxFolder,
                uid: message.uid,
                unread: message.unread,
                answered: message.answered,
                flagged: message.flagged
            }).returns(resolves());

            localListStub.withArgs({
                folder: inboxFolder,
                uid: message.uid
            }).returns(resolves([message]));

            localStoreStub.withArgs({
                folder: inboxFolder,
                emails: [message]
            }).returns(resolves());

            return dao.setFlags({
                folder: inboxFolder,
                message: message
            }).then(function() {
                expect(imapMark.calledOnce).to.be.true;
                expect(localListStub.calledOnce).to.be.true;
                expect(localStoreStub.calledOnce).to.be.true;
            });
        });

        it('should not explode when message has been deleted during imap roundtrip', function() {
            imapMark.withArgs({
                folder: inboxFolder,
                uid: message.uid,
                unread: message.unread,
                answered: message.answered,
                flagged: message.flagged
            }).returns(resolves());

            localListStub.withArgs({
                folder: inboxFolder,
                uid: message.uid
            }).returns(resolves([]));

            return dao.setFlags({
                folder: inboxFolder,
                message: message
            }).then(function() {
                expect(imapMark.calledOnce).to.be.true;
                expect(localListStub.calledOnce).to.be.true;
                expect(localStoreStub.called).to.be.false;
            });
        });

        it('should set flags for outbox for disk, memory', function() {
            localListStub.withArgs({
                folder: outboxFolder,
                uid: message.uid
            }).returns(resolves([message]));

            localStoreStub.withArgs({
                folder: outboxFolder,
                emails: [message]
            }).returns(resolves());

            return dao.setFlags({
                folder: outboxFolder,
                message: message
            }).then(function() {
                expect(imapMark.called).to.be.false;
                expect(localListStub.calledOnce).to.be.true;
                expect(localStoreStub.calledOnce).to.be.true;
            });
        });

        it('should set flags for disk, memory', function() {
            localListStub.withArgs({
                folder: inboxFolder,
                uid: message.uid
            }).returns(resolves([message]));

            localStoreStub.withArgs({
                folder: inboxFolder,
                emails: [message]
            }).returns(resolves());

            return dao.setFlags({
                folder: inboxFolder,
                message: message,
                localOnly: true
            }).then(function() {
                expect(imapMark.called).to.be.false;
                expect(localListStub.calledOnce).to.be.true;
                expect(localStoreStub.calledOnce).to.be.true;
            });
        });

        it('should fail to set flags for imap', function(done) {
            imapMark.returns(rejects({}));
            localListStub.returns(resolves([message]));
            localStoreStub.returns(resolves());

            dao.setFlags({
                folder: inboxFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapMark.calledOnce).to.be.true;
                expect(localListStub.called).to.be.false;
                expect(localStoreStub.called).to.be.false;

                done();
            });
        });
        it('should fail to set flags for imap in offline mode', function(done) {
            account.online = false;
            localListStub.returns(resolves([message]));
            localStoreStub.returns(resolves());

            dao.setFlags({
                folder: inboxFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapMark.called).to.be.false;
                expect(localListStub.called).to.be.false;
                expect(localStoreStub.called).to.be.false;

                done();
            });
        });
    });

    describe('#moveMessage', function() {
        var localDeleteStub, imapMoveStub, message;

        beforeEach(function() {
            localDeleteStub = sinon.stub(dao, '_localDeleteMessage');
            imapMoveStub = sinon.stub(dao, '_imapMoveMessage');
            message = {
                uid: 123
            };
            inboxFolder.messages.push(message);
        });

        it('should move a message to a destination folder', function() {
            imapMoveStub.withArgs({
                folder: inboxFolder,
                destination: sentFolder,
                uid: message.uid
            }).returns(resolves());

            localDeleteStub.withArgs({
                folder: inboxFolder,
                uid: message.uid
            }).returns(resolves());

            return dao.moveMessage({
                folder: inboxFolder,
                destination: sentFolder,
                message: message
            }).then(function() {
                expect(imapMoveStub.calledOnce).to.be.true;
                expect(localDeleteStub.calledOnce).to.be.true;
                expect(inboxFolder.messages).to.not.contain(message);
            });
        });

        it('should not a message if IMAP errors', function(done) {
            imapMoveStub.withArgs({
                folder: inboxFolder,
                destination: sentFolder,
                uid: message.uid
            }).returns(rejects(new Error()));

            dao.moveMessage({
                folder: inboxFolder,
                destination: sentFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapMoveStub.calledOnce).to.be.true;
                expect(localDeleteStub.called).to.be.false;
                expect(inboxFolder.messages).to.contain(message);

                done();
            });
        });

        it('should fail at delete from imap in offline', function(done) {
            account.online = false;

            dao.moveMessage({
                folder: inboxFolder,
                destination: sentFolder,
                message: message
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapMoveStub.called).to.be.false;
                expect(localDeleteStub.called).to.be.false;
                expect(inboxFolder.messages).to.contain(message);

                done();
            });
        });
    });

    describe('#getBody', function() {
        var localListStub, localStoreStub, fetchMessagesStub, uid;

        beforeEach(function() {
            uid = 12345;
            localListStub = sinon.stub(dao, '_localListMessages');
            localStoreStub = sinon.stub(dao, '_localStoreMessages');
            fetchMessagesStub = sinon.stub(dao, '_fetchMessages');
        });

        it('should not do anything if the message already has content', function() {
            var message = {
                body: 'bender is great!'
            };

            dao.getBody({
                messages: [message]
            });

            // should do nothing
        });

        it('should read a body from the device', function(done) {
            var body = 'bender is great! bender is great!';
            var message = {
                uid: uid
            };

            localListStub.withArgs({
                folder: inboxFolder,
                uid: [uid]
            }).returns(resolves([{
                uid: uid,
                bodyParts: [{
                    type: 'text',
                    content: body
                }]
            }]));

            dao.getBody({
                messages: [message],
                folder: inboxFolder
            }).then(function() {
                expect(message.body).to.equal(body);
                expect(message.loadingBody).to.be.false;

                expect(localListStub.calledOnce).to.be.true;
            }).then(done, done);
            expect(message.loadingBody).to.be.true;
        });

        it('should stream from imap and set body', function(done) {
            var body = 'bender is great! bender is great!';
            var uid = 1234;
            var message = {
                uid: uid
            };

            localListStub.withArgs({
                folder: inboxFolder,
                uid: [uid]
            }).returns(resolves([]));

            fetchMessagesStub.withArgs({
                messages: [message],
                folder: inboxFolder
            }).returns(resolves([{
                uid: uid,
                encrypted: false,
                bodyParts: [{
                    type: 'text',
                    content: body
                }]
            }]));

            dao.getBody({
                messages: [message],
                folder: inboxFolder
            }).then(function() {
                expect(message.body).to.equal(body);
                expect(message.loadingBody).to.be.false;

                expect(localListStub.calledOnce).to.be.true;
                expect(fetchMessagesStub.calledOnce).to.be.true;
            }).then(done, done);
            expect(message.loadingBody).to.be.true;
        });

        it('should not error when message is not available in imap', function(done) {
            var message = {
                uid: uid,
                encrypted: true,
                bodyParts: [{
                    type: 'text'
                }]
            };

            localListStub.withArgs({
                folder: inboxFolder,
                uid: [uid]
            }).returns(resolves());

            fetchMessagesStub.withArgs({
                messages: [message],
                folder: inboxFolder
            }).returns(rejects(new Error()));


            dao.getBody({
                messages: [message],
                folder: inboxFolder
            }).then(function(msgs) {
                expect(msgs).to.be.empty;
                expect(message.body).to.not.exist;
                expect(message.loadingBody).to.be.false;

                expect(localListStub.calledOnce).to.be.true;
                expect(fetchMessagesStub.calledOnce).to.be.true;
            }).then(done, done);

            expect(message.loadingBody).to.be.true;
        });
    });

    describe('#getAttachment', function() {
        var imapGetStub, uid;

        beforeEach(function() {
            uid = 123456;
            imapGetStub = sinon.stub(dao, '_getBodyParts');
        });

        it('should fetch an attachment from imap', function() {
            var attmt = {};

            imapGetStub.withArgs({
                folder: inboxFolder,
                uid: uid,
                bodyParts: [attmt]
            }).returns(resolves([{
                content: 'CONTENT!!!'
            }]));

            return dao.getAttachment({
                folder: inboxFolder,
                uid: uid,
                attachment: attmt
            }).then(function(fetchedAttmt) {
                expect(fetchedAttmt).to.equal(attmt);
                expect(attmt.content).to.not.be.empty;
                expect(imapGetStub.calledOnce).to.be.true;
            });
        });

        it('should error during fetch', function(done) {
            var attmt = {};

            imapGetStub.returns(resolves());

            dao.getAttachment({
                folder: inboxFolder,
                uid: uid,
                attachment: attmt
            }).catch(function(err) {
                expect(err).to.exist;
                expect(imapGetStub.calledOnce).to.be.true;

                done();
            });
        });
    });

    describe('#sendPlaintext', function() {
        var credentials,
            dummyMail,
            msg;

        beforeEach(function() {
            credentials = {
                smtp: {
                    host: 'foo.io'
                }
            };
            dummyMail = {};
            msg = 'wow. such message. much rfc2822.';
        });

        it('should send in the plain and upload to sent', function() {
            plainMailerStub.send.withArgs(dummyMail, {
                smtpclient: undefined
            }).returns(resolves(msg));
            authStub.getCredentials.returns(resolves(credentials));

            imapClientStub.uploadMessage.withArgs({
                path: sentFolder.path,
                message: msg
            }).returns(resolves());

            return dao.sendPlaintext(dummyMail, {
                mailer: plainMailerStub
            }).then(function() {
                expect(authStub.getCredentials.calledOnce).to.be.true;
                expect(plainMailerStub.send.calledOnce).to.be.true;
                expect(imapClientStub.uploadMessage.calledOnce).to.be.true;
            });
        });

        it('should send in the plain and not upload to sent', function() {
            dao.ignoreUploadOnSent = true;
            credentials.smtp.host = 'smtp.gmail.com';

            plainMailerStub.send.withArgs(dummyMail, {
                smtpclient: undefined
            }).returns(resolves(msg));
            authStub.getCredentials.returns(resolves(credentials));

            return dao.sendPlaintext(dummyMail, {
                mailer: plainMailerStub
            }).then(function() {
                expect(authStub.getCredentials.calledOnce).to.be.true;
                expect(plainMailerStub.send.calledOnce).to.be.true;
                expect(imapClientStub.uploadMessage.called).to.be.false;
            });
        });

        it('should send and ignore error on upload', function() {
            imapClientStub.uploadMessage.returns(rejects(new Error()));
            plainMailerStub.send.returns(resolves(msg));
            authStub.getCredentials.returns(resolves(credentials));

            return dao.sendPlaintext(dummyMail, {
                mailer: plainMailerStub
            }).then(function() {
                expect(authStub.getCredentials.calledOnce).to.be.true;
                expect(plainMailerStub.send.calledOnce).to.be.true;
                expect(imapClientStub.uploadMessage.calledOnce).to.be.true;
            });
        });

        it('should not send due to error', function(done) {
            plainMailerStub.send.returns(rejects({}));
            authStub.getCredentials.returns(resolves(credentials));

            return dao.sendPlaintext(dummyMail, {
                mailer: plainMailerStub
            }).catch(function(err) {
                expect(err).to.exist;
                expect(authStub.getCredentials.calledOnce).to.be.true;
                expect(plainMailerStub.send.calledOnce).to.be.true;
                expect(imapClientStub.uploadMessage.called).to.be.false;
                done();
            });
        });

        it('should not send in offline mode', function(done) {
            account.online = false;

            return dao.sendPlaintext(dummyMail, {
                mailer: plainMailerStub
            }).catch(function(err) {
                expect(err.code).to.equal(42);
                expect(authStub.getCredentials.called).to.be.false;
                expect(plainMailerStub.send.called).to.be.false;
                expect(imapClientStub.uploadMessage.called).to.be.false;
                done();
            });
        });
    });

    describe('event handlers', function() {

        describe('#connectImap', function() {
            var initFoldersStub, credentials;

            beforeEach(function() {
                initFoldersStub = sinon.stub(dao, '_updateFolders');
                sinon.stub(dao, 'isOnline');
                delete dao._imapClient;

                credentials = {
                    imap: {}
                };
            });

            it('should connect', function() {
                account.folders = [inboxFolder];
                inboxFolder.uids = [123];
                dao.isOnline.returns(true);
                authStub.getCredentials.returns(resolves(credentials));
                imapClientStub.login.returns(resolves());
                imapClientStub.selectMailbox.returns(resolves());
                imapClientStub.listenForChanges.returns(resolves());
                initFoldersStub.returns(resolves());

                return dao.connectImap(imapClientStub).then(function() {
                    expect(imapClientStub.login.calledOnce).to.be.true;
                    expect(imapClientStub.selectMailbox.calledOnce).to.be.true;
                    expect(initFoldersStub.calledOnce).to.be.true;
                    expect(imapClientStub.mailboxCache).to.deep.equal({
                        'INBOX': {
                            exists: 123,
                            uidNext: 124,
                            uidlist: [123],
                            highestModseq: '123'
                        }
                    });
                });
            });

            it('should not connect when user agent is offline', function() {
                dao.isOnline.returns(false);

                return dao.connectImap(imapClientStub).then(function() {
                    expect(authStub.getCredentials.called).to.be.false;
                });
            });
        });

        describe('#disconnectImap', function() {
            it('should discard imapClient and plainMailer', function() {
                imapClientStub.stopListeningForChanges.returns(resolves());
                imapClientStub.logout.returns(resolves());

                return dao.disconnectImap().then(function() {
                    expect(imapClientStub.stopListeningForChanges.calledOnce).to.be.true;
                    expect(imapClientStub.logout.calledOnce).to.be.true;
                    expect(dao._account.online).to.be.false;
                    expect(dao._imapClient).to.not.exist;
                });

            });
        });

        describe('#_onSyncUpdate', function() {
            var getBodyStub, deleteMessagesStub, setFlagsStub, localStoreFoldersStub;
            var msgs;

            beforeEach(function() {
                msgs = [{
                    uid: 5,
                    flags: ['\\Answered', '\\Seen'],
                    bodyParts: []
                }];
                inboxFolder.messages = msgs;
                inboxFolder.uids = [5];
                getBodyStub = sinon.stub(dao, 'getBody');
                deleteMessagesStub = sinon.stub(dao, 'deleteMessage');
                setFlagsStub = sinon.stub(dao, 'setFlags');
                localStoreFoldersStub = sinon.stub(dao, '_localStoreFolders');
            });

            it('should get new message', function(done) {
                getBodyStub.withArgs({
                    folder: inboxFolder,
                    messages: [{
                        uid: 7
                    }, {
                        uid: 8
                    }],
                    notifyNew: true
                }).returns(resolves());

                localStoreFoldersStub.returns(resolves());

                dao._onSyncUpdate({
                    type: 'new',
                    path: inboxFolder.path,
                    list: [1, 7, 8]
                });

                setTimeout(function() {
                    expect(getBodyStub.calledOnce).to.be.true;
                    expect(localStoreFoldersStub.calledOnce).to.be.true;
                    done();
                }, 0);
            });

            it('should delete message', function(done) {
                deleteMessagesStub.withArgs({
                    folder: inboxFolder,
                    message: msgs[0],
                    localOnly: true
                }).returns(resolves());

                dao._onSyncUpdate({
                    type: 'deleted',
                    path: inboxFolder.path,
                    list: [5]
                });

                setTimeout(function() {
                    expect(deleteMessagesStub.calledOnce).to.be.true;
                    done();
                }, 0);
            });

            it('should fetch flags', function(done) {
                setFlagsStub.withArgs({
                    folder: inboxFolder,
                    message: msgs[0],
                    localOnly: true
                }).returns(resolves());

                dao._onSyncUpdate({
                    type: 'messages',
                    path: inboxFolder.path,
                    list: msgs
                });

                setTimeout(function() {
                    expect(setFlagsStub.calledOnce).to.be.true;
                    done();
                }, 0);
            });
        });
    });


    describe('internal API', function() {
        describe('#_updateFolders', function() {
            beforeEach(function() {
                sinon.stub(dao, 'getBody');
            });

            it('should initialize from imap if online', function() {
                account.folders = [];
                inboxFolder.uids = [7];
                inboxFolder.messages = undefined;
                imapClientStub.listWellKnownFolders.returns(resolves({
                    Inbox: [inboxFolder],
                    Sent: [sentFolder],
                    Drafts: [draftsFolder],
                    Trash: [trashFolder],
                    Flagged: [flaggedFolder],
                    Other: [otherFolder]
                }));
                devicestorageStub.storeList.withArgs(sinon.match(function(arg) {
                    expect(arg[0][0].name).to.deep.equal(inboxFolder.name);
                    expect(arg[0][0].path).to.deep.equal(inboxFolder.path);
                    expect(arg[0][0].type).to.deep.equal(inboxFolder.type);
                    expect(arg[0][1].name).to.deep.equal(sentFolder.name);
                    expect(arg[0][1].path).to.deep.equal(sentFolder.path);
                    expect(arg[0][1].type).to.deep.equal(sentFolder.type);
                    expect(arg[0][2].name).to.deep.equal(outboxFolder.name);
                    expect(arg[0][2].path).to.deep.equal(outboxFolder.path);
                    expect(arg[0][2].type).to.deep.equal(outboxFolder.type);
                    expect(arg[0][3].name).to.deep.equal(draftsFolder.name);
                    expect(arg[0][3].path).to.deep.equal(draftsFolder.path);
                    expect(arg[0][3].type).to.deep.equal(draftsFolder.type);
                    expect(arg[0][4].name).to.deep.equal(trashFolder.name);
                    expect(arg[0][4].path).to.deep.equal(trashFolder.path);
                    expect(arg[0][4].type).to.deep.equal(trashFolder.type);
                    expect(arg[0][5].name).to.deep.equal(flaggedFolder.name);
                    expect(arg[0][5].path).to.deep.equal(flaggedFolder.path);
                    expect(arg[0][5].type).to.deep.equal(flaggedFolder.type);
                    expect(arg[0][6].name).to.deep.equal(otherFolder.name);
                    expect(arg[0][6].path).to.deep.equal(otherFolder.path);
                    expect(arg[0][6].type).to.deep.equal(otherFolder.type);
                    return true;
                }), 'folders').returns(resolves());

                dao.getBody.withArgs({
                    folder: inboxFolder,
                    messages: [{
                        uid: 7
                    }]
                }).returns(resolves());

                return dao._updateFolders().then(function() {
                    expect(imapClientStub.listWellKnownFolders.calledOnce).to.be.true;
                    expect(devicestorageStub.storeList.calledOnce).to.be.true;
                    expect(dao.getBody.calledOnce).to.be.true;
                });
            });

            it('should update folders from imap', function() {
                account.folders = [inboxFolder, outboxFolder, trashFolder, {
                    name: 'foo',
                    type: 'Sent',
                    path: 'bar',
                }];

                imapClientStub.listWellKnownFolders.returns(resolves({
                    Inbox: [inboxFolder],
                    Sent: [sentFolder],
                    Drafts: [draftsFolder],
                    Trash: [trashFolder],
                    Flagged: [flaggedFolder],
                    Other: [otherFolder]
                }));
                devicestorageStub.storeList.withArgs(sinon.match(function(arg) {
                    expect(arg[0][0].name).to.deep.equal(inboxFolder.name);
                    expect(arg[0][0].path).to.deep.equal(inboxFolder.path);
                    expect(arg[0][0].type).to.deep.equal(inboxFolder.type);
                    expect(arg[0][1].name).to.deep.equal(sentFolder.name);
                    expect(arg[0][1].path).to.deep.equal(sentFolder.path);
                    expect(arg[0][1].type).to.deep.equal(sentFolder.type);
                    expect(arg[0][2].name).to.deep.equal(outboxFolder.name);
                    expect(arg[0][2].path).to.deep.equal(outboxFolder.path);
                    expect(arg[0][2].type).to.deep.equal(outboxFolder.type);
                    expect(arg[0][3].name).to.deep.equal(draftsFolder.name);
                    expect(arg[0][3].path).to.deep.equal(draftsFolder.path);
                    expect(arg[0][3].type).to.deep.equal(draftsFolder.type);
                    expect(arg[0][4].name).to.deep.equal(trashFolder.name);
                    expect(arg[0][4].path).to.deep.equal(trashFolder.path);
                    expect(arg[0][4].type).to.deep.equal(trashFolder.type);
                    expect(arg[0][5].name).to.deep.equal(flaggedFolder.name);
                    expect(arg[0][5].path).to.deep.equal(flaggedFolder.path);
                    expect(arg[0][5].type).to.deep.equal(flaggedFolder.type);
                    expect(arg[0][6].name).to.deep.equal(otherFolder.name);
                    expect(arg[0][6].path).to.deep.equal(otherFolder.path);
                    expect(arg[0][6].type).to.deep.equal(otherFolder.type);
                    return true;
                }), 'folders').returns(resolves());

                return dao._updateFolders().then(function() {
                    expect(imapClientStub.listWellKnownFolders.calledOnce).to.be.true;
                    expect(devicestorageStub.storeList.calledOnce).to.be.true;
                    expect(dao.getBody.called).to.be.false;
                });
            });
        });

        describe('#_imapMark', function() {
            it('should flag a mail', function() {
                imapClientStub.updateFlags.withArgs({
                    path: inboxFolder.path,
                    folder: inboxFolder,
                    uid: 1,
                    unread: false,
                    answered: false
                }).returns(resolves());

                return dao._imapMark({
                    folder: inboxFolder,
                    uid: 1,
                    unread: false,
                    answered: false
                }).then(function() {
                    expect(imapClientStub.updateFlags.calledOnce).to.be.true;
                });
            });
        });

        describe('#_imapMoveMessage', function() {
            it('should move a message to a destination folder', function() {
                imapClientStub.moveMessage.withArgs({
                    path: inboxFolder.path,
                    destination: sentFolder.path,
                    uid: 123
                }).returns(resolves());

                return dao._imapMoveMessage({
                    folder: inboxFolder,
                    destination: sentFolder,
                    uid: 123
                });
            });
        });

        describe('#_imapDeleteMessage', function() {
            var uid = 1337;

            it('should fail when disconnected', function(done) {
                dao._account.online = false;

                dao._imapDeleteMessage({}).catch(function(err) {
                    expect(err.code).to.equal(42);
                    done();
                });
            });

            it('should move to trash', function() {
                imapClientStub.moveMessage.withArgs({
                    path: inboxFolder.path,
                    uid: uid,
                    destination: trashFolder.path
                }).returns(resolves());

                return dao._imapDeleteMessage({
                    folder: inboxFolder,
                    uid: uid
                });
            });

            it('should purge message', function() {
                imapClientStub.deleteMessage.withArgs({
                    path: trashFolder.path,
                    uid: uid
                }).returns(resolves());

                return dao._imapDeleteMessage({
                    folder: trashFolder,
                    uid: uid
                });
            });
        });

        describe('#_fetchMessages', function() {
            var localStoreStub, localStoreFoldersStub, getBodyPartsStub;
            var messages;

            beforeEach(function() {
                localStoreStub = sinon.stub(dao, '_localStoreMessages');
                localStoreFoldersStub = sinon.stub(dao, '_localStoreFolders');
                getBodyPartsStub = sinon.stub(dao, '_getBodyParts');
                messages = [{
                    uid: 1337,
                    subject: 'asdasd',
                    unread: true,
                    modseq: '124',
                    bodyParts: [{
                        type: 'text'
                    }]
                }, {
                    uid: 1339,
                    subject: 'asdasd',
                    unread: true,
                    modseq: '124',
                    bodyParts: [{
                        type: 'attachment'
                    }]
                }];
            });

            it('should list messages', function() {
                imapClientStub.listMessages.withArgs({
                    path: inboxFolder.path,
                    uids: [1337, 1339]
                }).returns(resolves(messages));
                localStoreStub.withArgs({
                    folder: inboxFolder,
                    emails: [messages[0]]
                }).returns(resolves());
                localStoreStub.withArgs({
                    folder: inboxFolder,
                    emails: [messages[1]]
                }).returns(resolves());
                localStoreFoldersStub.returns(resolves());
                getBodyPartsStub.withArgs({
                    folder: inboxFolder,
                    uid: messages[0].uid,
                    bodyParts: messages[0].bodyParts
                }).returns(resolves(messages[0].bodyParts));

                return dao._fetchMessages({
                    folder: inboxFolder,
                    messages: messages
                }).then(function(msgs) {
                    expect(msgs).to.exist;

                    expect(imapClientStub.listMessages.calledOnce).to.be.true;
                    expect(localStoreStub.calledOnce).to.be.true;
                    expect(getBodyPartsStub.calledOnce).to.be.true;
                });
            });

            it('should fail when listMessages fails', function(done) {
                imapClientStub.listMessages.returns(rejects({}));

                dao._fetchMessages({
                    folder: inboxFolder,
                    messages: messages
                }).catch(function(err) {
                    expect(err).to.exist;
                    expect(imapClientStub.listMessages.calledOnce).to.be.true;

                    done();
                });
            });

            it('should fail when disconnected', function(done) {
                dao._account.online = false;

                dao._fetchMessages({}).catch(function(err) {
                    expect(err.code).to.equal(42);
                    done();
                });
            });
        });

        describe('#_imapUploadMessage', function() {
            it('should upload a message', function() {
                var msg = 'wow. such message. much rfc2822.';

                imapClientStub.uploadMessage.withArgs({
                    path: draftsFolder.path,
                    message: msg
                }).returns(resolves());

                return dao._imapUploadMessage({
                    folder: draftsFolder,
                    message: msg
                }).then(function() {
                    expect(imapClientStub.uploadMessage.calledOnce).to.be.true;
                });
            });
        });

        describe('#_getBodyParts', function() {
            it('should get bodyParts', function() {
                var bp = [{
                    type: 'text',
                    content: 'bender is great! bender is great!'
                }];

                imapClientStub.getBodyParts.withArgs({
                    folder: inboxFolder,
                    path: inboxFolder.path,
                    uid: 123,
                    bodyParts: bp
                }).returns(resolves(bp));
                parseStub.yieldsAsync(null, []);

                return dao._getBodyParts({
                    folder: inboxFolder,
                    uid: 123,
                    bodyParts: bp
                }).then(function(parts) {
                    expect(parts).to.exist;

                    expect(imapClientStub.getBodyParts.calledOnce).to.be.true;
                    expect(parseStub.calledOnce).to.be.true;
                });
            });

            it('should fail when deleted on IMAP', function(done) {
                var bp = [{
                    type: 'text'
                }];

                imapClientStub.getBodyParts.withArgs({
                    folder: inboxFolder,
                    path: inboxFolder.path,
                    uid: 123,
                    bodyParts: bp
                }).returns(resolves());
                parseStub.yieldsAsync(null, []);

                dao._getBodyParts({
                    folder: inboxFolder,
                    uid: 123,
                    bodyParts: bp
                }).catch(function(err) {
                    expect(err).to.exist;

                    expect(imapClientStub.getBodyParts.calledOnce).to.be.true;
                    expect(parseStub.called).to.be.false;

                    done();
                });
            });

            it('should fail when getBody fails', function(done) {
                imapClientStub.getBodyParts.returns(rejects({}));

                dao._getBodyParts({
                    folder: inboxFolder,
                    uid: 123,
                    bodyParts: []
                }).catch(function(err) {
                    expect(err).to.exist;

                    expect(imapClientStub.getBodyParts.calledOnce).to.be.true;
                    expect(parseStub.called).to.be.false;

                    done();
                });
            });

            it('should fail when getBody fails', function(done) {
                imapClientStub.getBodyParts.returns(rejects({}));

                dao._getBodyParts({
                    folder: inboxFolder,
                    uid: 123,
                    bodyParts: []
                }).catch(function(err) {
                    expect(err).to.exist;

                    expect(imapClientStub.getBodyParts.calledOnce).to.be.true;
                    expect(parseStub.called).to.be.false;

                    done();
                });
            });

            it('should fail when disconnected', function(done) {
                dao._account.online = false;

                dao._getBodyParts({}).catch(function(err) {
                    expect(err.code).to.equal(42);
                    done();
                });
            });
        });

        describe('#_localListMessages', function() {
            var uid = 123;

            it('should list without uid', function() {
                devicestorageStub.listItems.withArgs('email_' + inboxFolder.path, true).returns(resolves([{}]));

                return dao._localListMessages({
                    folder: inboxFolder
                }).then(function(messages) {
                    expect(messages.length).to.exist;
                });
            });

            it('should list with uid', function() {
                devicestorageStub.listItems.withArgs('email_' + inboxFolder.path + '_' + uid, true).returns(resolves([{}]));

                return dao._localListMessages({
                    folder: inboxFolder,
                    uid: uid
                }).then(function(messages) {
                    expect(messages.length).to.exist;
                });
            });

        });

        describe('#_localStoreMessages', function() {
            it('should store messages', function() {
                devicestorageStub.storeList.withArgs([{}], 'email_' + inboxFolder.path).returns(resolves());

                return dao._localStoreMessages({
                    folder: inboxFolder,
                    emails: [{}]
                });
            });
        });

        describe('#_localDeleteMessage', function() {
            var uid = 1337;

            it('should delete message', function() {
                devicestorageStub.removeList.withArgs('email_' + inboxFolder.path + '_' + uid).returns(resolves());

                return dao._localDeleteMessage({
                    folder: inboxFolder,
                    uid: uid
                });
            });

            it('should fail when uid is missing', function(done) {
                dao._localDeleteMessage({
                    folder: inboxFolder
                }).catch(function(err) {
                    expect(err).to.exist;
                    done();
                });
            });

        });

        describe('#_uploadToSent', function() {
            it('should upload', function() {
                var msg = 'wow. such message. much rfc2822.';

                imapClientStub.uploadMessage.withArgs({
                    path: sentFolder.path,
                    message: msg
                }).returns(resolves());

                return dao._uploadToSent(msg).then(function() {
                    expect(imapClientStub.uploadMessage.calledOnce).to.be.true;
                });
            });
        });


        describe('#checkIgnoreUploadOnSent', function() {
            it('should ignore upload on gmail', function() {
                expect(dao.checkIgnoreUploadOnSent('bla.gmail.com')).to.be.true;
                expect(dao.checkIgnoreUploadOnSent('bla.googlemail.com')).to.be.true;
            });

            it('should not ignore upload on other domain', function() {
                expect(dao.checkIgnoreUploadOnSent('imap.foo.com')).to.be.false;
            });
        });
    });
});
