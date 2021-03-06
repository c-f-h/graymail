'use strict';

var buildMimeTree = require('./plainbuilder'),
    SmtpClient = require('emailjs-smtp-client');

/**
 * Constructor for the high level api.
 * @param {Number} options.port Port is the port to the server (defaults to 25 on non-secure and to 465 on secure connection).
 * @param {String} options.host Hostname of the server.
 * @param {String} options.auth.user Username for login
 * @param {String} options.auth.pass Password for login
 * @param {Boolean} options.secureConnection Indicates if the connection is using TLS or not
 * @param {String} options.tls Further optional object for tls.connect, e.g. { ca: 'PIN YOUR CA HERE' }
 */
var PlainMailer = function(options) {
    this._options = options;
};

module.exports = PlainMailer;

/**
 * Sends a mail object.
 * @param {Object} options.mail.from Array containing one object with the ASCII string representing the sender address, e.g. 'foo@bar.io'
 * @param {Array} options.mail.to (optional) Array of objects with the ASCII string representing the recipient (e.g. ['the.dude@lebowski.com', 'donny@kerabatsos.com'])
 * @param {Object} options.mail.cc (optional) Array of objects with the ASCII string representing the recipient, see mail.to
 * @param {Object} options.mail.bcc (optional) Array of objects with the ASCII string representing the recipient, see mail.to
 * @param {String} options.mail.subject String containing with the mail's subject
 * @param {String} options.mail.headers Object custom headers to add to the message header
 * @param {String} options.mail.body Plain text body to be sent with the mail
 * @param {Array} options.mail.attachments (optional) Array of attachment objects with filename {String}, content {Uint8Array}, and mimeType {String}
 *
 * * @return {Promise<String>} Resolves with the mail source when the mail has been sent
 */
PlainMailer.prototype.send = function(mail, options) {
    var self = this;

    return Promise.resolve(buildMimeTree(mail))
    .then(function(obj) {
        return new Promise(function(resolve, reject) {
            var smtp = options.smtpclient || new SmtpClient(self._options.host, self._options.port, {
                useSecureTransport: self._options.secure,
                ignoreTLS: self._options.ignoreTLS,
                requireTLS: self._options.requireTLS,
                ca: self._options.ca,
                tlsWorkerPath: self._options.tlsWorkerPath,
                auth: self._options.auth
            });

            smtp.oncert = self.onCert;

            smtp.onerror = function(error) {
                reject(error);
            };

            smtp.onidle = function() {
                // remove idle listener to prevent infinite loop
                smtp.onidle = function() {};
                // send envelope
                smtp.useEnvelope(obj.smtpInfo);
            };

            smtp.onready = function(failedRecipients) {
                if (failedRecipients && failedRecipients.length > 0) {
                    smtp.quit();
                    reject(new Error('Failed recipients: ' + JSON.stringify(failedRecipients)));
                    return;
                }

                // send rfc body
                smtp.end(obj.rfcMessage);
            };

            smtp.ondone = function(success) {
                if (!success) {
                    smtp.quit();
                    reject(new Error('Sent message was not queued successfully by SMTP server!'));
                    return;
                }

                // in some cases node.net throws an exception when we quit() the smtp client,
                // but the mail was already sent successfully, so we can ignore this error safely
                smtp.onerror = console.error;
                smtp.quit();

                resolve(obj.rfcMessage); // done!
            };

            // connect and wait for idle
            smtp.connect();
        });
    });
};
