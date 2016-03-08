'use strict';

module.exports = buildMimeTree;

var Mailbuild = require('emailjs-mime-builder');

/**
 * Builds the cleartext RFC message to be sent via SMTP
 * @param {Object} options.mail.from Array containing one object with the ASCII string representing the sender address, e.g. 'foo@bar.io'
 * @param {Array} options.mail.to (optional) Array of ASCII strings representing the recipient (e.g. ['the.dude@lebowski.com', 'donny@kerabatsos.com'])
 * @param {Array} options.mail.cc (optional) Array of ASCII strings representing the recipient, see mail.to
 * @param {Array} options.mail.bcc (optional) Array of ASCII strings representing the recipient, see mail.to
 * @param {String} options.mail.subject String containing with the mail's subject
 * @param {String} options.mail.body Plain text body to be sent with the mail
 * @param {Array} options.mail.attachments (optional) Array of attachment objects with filename {String}, content {Uint8Array}, and mimeType {String}
 *
 * @return {Promise<rfcMessage, smtpInfo>} Invoked when the mail has been built and the smtp information has been created.
 */
function buildMimeTree(mail, rootnode) {
    var rootNode = rootnode || new Mailbuild();

    _createMimeTree(mail, rootNode);
    _setEnvelope(mail, rootNode); // configure the envelope data

    return {
        rfcMessage: rootNode.build(),
        smtpInfo: rootNode.getEnvelope()
    };
}

//
// create the envelope data
//
function _setEnvelope(mail, rootNode) {
    rootNode.setHeader({
        subject: mail.subject,
        from: mail.from,
        to: mail.to,
        cc: mail.cc,
        bcc: mail.bcc
    });

    // set custom headers
    if (mail.headers) {
        rootNode.setHeader(mail.headers);
    }
}

function _createMimeTree(mail, rootNode) {
    var contentNode=rootNode, textNode;

    //
    // create the mime tree
    //

    mail.bodyParts = [{
        type: 'plain',
        content: []
    }];

    // this a plain text mail? then only one text/plain node is needed
    if (!mail.attachments || mail.attachments.length === 0) {
        contentNode.setHeader('content-type', 'text/plain');
        contentNode.setHeader('content-transfer-encoding', 'quoted-printable');
        contentNode.setContent(mail.body);
    } else {
        // we have attachments, so let's create a multipart/mixed mail
        contentNode.setHeader('content-type', 'multipart/mixed');

        // create the text/plain node
        textNode = contentNode.createChild('text/plain');
        textNode.setHeader('content-transfer-encoding', 'quoted-printable');
        textNode.setContent(mail.body);

        // add the attachments
        mail.attachments.forEach(function(attmtObj) {
            var mimeType = 'application/octet-stream';
            var attmtNode = contentNode.createChild(mimeType);
            attmtNode.setHeader('content-transfer-encoding', 'base64');
            attmtNode.filename = attmtObj.filename;
            attmtNode.setContent(attmtObj.content);
        });
    }
}
