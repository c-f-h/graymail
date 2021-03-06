'use strict';

//
// Controller
//

var validateEmailAddress = require('../../util/validate-email');

var WriteCtrl = function($scope, $window, $filter, $q, appConfig, auth, email, outbox, dialog, axe, status) {

    var str = appConfig.string;
    var cfg = appConfig.config;

    //
    // Init
    //

    $scope.state.writer = {
        write: function(replyTo, replyAll, forward) {
            $scope.state.lightbox = 'write';
            $scope.replyTo = replyTo;

            resetFields();

            // fill fields depending on replyTo
            fillFields(replyTo, replyAll, forward);

            $scope.verify($scope.to[0]);
        },
        reportBug: function() {
            $scope.state.lightbox = 'write';
            resetFields();
            reportBug();
            $scope.verify($scope.to[0]);
        },
        close: function() {
            $scope.state.lightbox = undefined;
        }
    };

    function resetFields() {
        $scope.writerTitle = 'New email';
        $scope.to = [];
        $scope.showCC = false;
        $scope.cc = [];
        $scope.showBCC = false;
        $scope.bcc = [];
        $scope.subject = '';
        $scope.body = '';
        $scope.attachments = [];
        $scope.addressBookCache = undefined;
    }

    function reportBug() {
        var dump = '';
        var appender = {
            log: function(level, date, component, log) {
                // add a tag for the log level
                if (level === axe.DEBUG) {
                    dump += '[DEBUG]';
                } else if (level === axe.INFO) {
                    dump += '[INFO]';
                } else if (level === axe.WARN) {
                    dump += '[WARN]';
                } else if (level === axe.ERROR) {
                    dump += '[ERROR]';
                }

                dump += '[' + date.toISOString() + ']';

                // component is optional
                if (component) {
                    dump += '[' + component + ']';
                }

                // log may be an error or a string
                dump += ' ' + (log || '').toString();

                // if an error it is, a stack trace it has. print it, we should.
                if (log.stack) {
                    dump += ' . Stack: ' + log.stack;
                }

                dump += '\n';
            }
        };
        axe.dump(appender);

        $scope.to = [{
            address: str.supportAddress
        }];
        $scope.writerTitle = str.bugReportTitle;
        $scope.subject = str.bugReportSubject;
        $scope.body = str.bugReportBody.replace('{0}', navigator.userAgent).replace('{1}', cfg.appVersion) + dump;
    }

    function fillFields(re, replyAll, forward) {
        var replyTo, from, sentDate, body;

        if (!re) {
            return;
        }

        $scope.writerTitle = (forward) ? 'Forward' : 'Reply';

        replyTo = re.replyTo && re.replyTo[0] && re.replyTo[0].address || re.from[0].address;

        // fill recipient field and references
        if (!forward) {
            $scope.to.unshift({
                address: replyTo
            });
            $scope.to.forEach($scope.verify);

            $scope.references = (re.references || []);
            if (re.id && $scope.references.indexOf(re.id) < 0) {
                // references might not exist yet, so use the double concat
                $scope.references = $scope.references.concat(re.id);
            }
            if (re.id) {
                $scope.inReplyTo = re.id;
            }
        }
        if (replyAll) {
            re.to.concat(re.cc).forEach(function(recipient) {
                var me = auth.emailAddress;
                if (recipient.address === me && replyTo !== me) {
                    // don't reply to yourself
                    return;
                }
                $scope.cc.unshift({
                    address: recipient.address
                });
            });

            // filter duplicates
            $scope.cc = _.uniq($scope.cc, function(recipient) {
                return recipient.address;
            });
            $scope.showCC = true;
            $scope.cc.forEach($scope.verify);
        }

        // fill attachments and references on forward
        if (forward) {
            // create a new array, otherwise removing an attachment will also
            // remove it from the original in the mail list as a side effect
            $scope.attachments = [].concat(re.attachments);
            if (re.id) {
                $scope.references = [re.id];
            }
        }

        // fill subject
        if (forward) {
            $scope.subject = 'Fwd: ' + re.subject;
        } else {
            $scope.subject = re.subject ? 'Re: ' + re.subject.replace('Re: ', '') : '';
        }

        // fill text body
        from = re.from[0].name || replyTo;
        sentDate = $filter('date')(re.sentDate, 'EEEE, MMM d, yyyy h:mm a');

        function createString(array) {
            var str = '';
            array.forEach(function(to) {
                str += (str) ? ', ' : '';
                str += ((to.name) ? to.name : to.address) + ' <' + to.address + '>';
            });
            return str;
        }

        if (forward) {
            body = '\n\n' +
                '---------- Forwarded message ----------\n' +
                'From: ' + re.from[0].name + ' <' + re.from[0].address + '>\n' +
                'Date: ' + sentDate + '\n' +
                'Subject: ' + re.subject + '\n' +
                'To: ' + createString(re.to) + '\n' +
                ((re.cc && re.cc.length > 0) ? 'Cc: ' + createString(re.cc) + '\n' : '') +
                '\n\n';

        } else {
            body = '\n\n' + sentDate + ' ' + from + ' wrote:\n> ';
        }

        if (re.body) {
            body += re.body.trim().split('\n').join('\n> ').replace(/ >/g, '>');
            $scope.body = body;
        }
    }

    //
    // Editing headers
    //

    /**
     * Verify email address
     */
    $scope.verify = function(recipient) {
        if (!recipient) {
            return;
        }
        
        if (recipient.address) {
            // display only email address after autocomplete
            recipient.displayId = recipient.address;
        } else {
            // set address after manual input
            recipient.address = recipient.displayId;
        }

        $scope.checkSendStatus();
    };

    /**
     * Check if it is ok to send an email depending on validity of the addresses
     */
    $scope.checkSendStatus = function() {
        $scope.okToSend = false;

        var anyReceivers = false;
        var allOk = true;

        // count number of receivers and check security
        $scope.to.forEach(check);
        $scope.cc.forEach(check);
        $scope.bcc.forEach(check);

        function check(recipient) {
            if (!validateEmailAddress(recipient.address)) {
                allOk = false;
            } else {
                anyReceivers = true;
            }
        }

        // only allow sending if there are receivers and all are valid exist
        if (anyReceivers && allOk) {
            // send plaintext
            $scope.okToSend = true;
        }
    };

    //
    // Editing attachments
    //

    $scope.remove = function(attachment) {
        $scope.attachments.splice($scope.attachments.indexOf(attachment), 1);
    };


    //
    // Editing email body
    //

    $scope.sendToOutbox = function() {
        var message;

        // build email model for smtp-client
        message = {
            from: [{
                name: auth.realname,
                address: auth.emailAddress
            }],
            to: $scope.to.filter(filterEmptyAddresses),
            cc: $scope.cc.filter(filterEmptyAddresses),
            bcc: $scope.bcc.filter(filterEmptyAddresses),
            subject: $scope.subject.trim() ? $scope.subject.trim() : str.fallbackSubject, // Subject line, or the fallback subject, if nothing valid was entered
            body: $scope.body.trim(), // use parsed plaintext body
            attachments: $scope.attachments,
            sentDate: new Date(),
            headers: {}
        };

        if ($scope.inReplyTo) {
            message.headers['in-reply-to'] = '<' + $scope.inReplyTo + '>';
        }

        if ($scope.references && $scope.references.length) {
            message.headers.references = $scope.references.map(function(reference) {
                return '<' + reference + '>';
            }).join(' ');
        }

        // close the writer
        $scope.state.writer.close();
        // close read mode after reply
        if ($scope.replyTo) {
            status.setReading(false);
        }

        // persist the email to disk for later sending
        return $q(function(resolve) {
            resolve();

        }).then(function() {
            return outbox.put(message);

        }).then(function() {
            // if we need to synchronize replyTo.answered = true to imap,
            // let's do that. otherwise, we're done
            if (!$scope.replyTo || $scope.replyTo.answered) {
                return;
            }

            $scope.replyTo.answered = true;
            return email.setFlags({
                folder: currentFolder(),
                message: $scope.replyTo
            });

        }).catch(function(err) {
            if (err.code !== 42) {
                dialog.error(err);
            }
        });
    };

    //
    // Tag input & Autocomplete
    //

    $scope.tagStyle = function(recipient) {
        return validateEmailAddress(recipient.address) ? ['label'] : ['label', 'label--invalid'];
    };

    $scope.lookupAddressBook = function(query) {
        return $q(function(resolve) {
            resolve();

        }).then(function() {
            if ($scope.addressBookCache) {
                return;
            }

            // entries should be of the form { address: '', displayId: '' }
            $scope.addressBookCache = [];  // TODO: some sort of contact list (Google Contacts?)

        }).then(function() {
            // filter the address book cache
            return $scope.addressBookCache.filter(function(i) {
                return i.displayId.toLowerCase().indexOf(query.toLowerCase()) !== -1;
            });

        }).catch(dialog.error);
    };

    //
    // Helpers
    //

    function currentFolder() {
        return $scope.state.nav.currentFolder;
    }

    /*
     * Visitor to filter out objects without an address property, i.e. empty addresses
     */
    function filterEmptyAddresses(addr) {
        return !!addr.address;
    }
};

module.exports = WriteCtrl;
