'use strict';

var appCfg = {};

var ngModule = angular.module('woAppConfig', []);
ngModule.factory('appConfig', function() {
    return appCfg;
});
module.exports = appCfg;

/**
 * Global app configurations
 */
appCfg.config = {
    pgpComment: 'Graymail',
    oauthDomains: [/\.gmail\.com$/, /\.googlemail\.com$/],
    ignoreUploadOnSentDomains: [/\.gmail\.com$/, /\.googlemail\.com$/],
    workerPath: 'js',
    reconnectInterval: 10000,
    checkOutboxInterval: 5000,
    iconPath: '/img/icon-128-chrome.png',
    dbVersion: 6,
    appVersion: undefined,
    outboxMailboxPath: 'OUTBOX',
    outboxMailboxName: 'Outbox',
    outboxMailboxType: 'Outbox',
    connDocTimeout: 5000,
    imapUpdateBatchSize: 25
};

// parse manifest to get configurations for current runtime
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    setConfigParams(chrome.runtime.getManifest());
}/* else if (typeof $ !== 'undefined' && $.get) {
    $.get('/manifest.json', setConfigParams, 'json');
}*/

function setConfigParams(manifest) {
    var cfg = appCfg.config;

    // get the app version
    cfg.appVersion = manifest.version;
}

/**
 * Strings are maintained here
 */
appCfg.string = {
    fallbackSubject: '(no subject)',
    sendBtnClear: 'Send',
    sendBtnSecure: 'Send securely',
    updateCertificateTitle: 'Warning',
    updateCertificateMessage: 'The SSL certificate for the mail server {0} changed. Do you want to proceed?',
    updateCertificatePosBtn: 'Yes',
    updateCertificateNegBtn: 'No',
    bugReportTitle: 'Report a bug',
    bugReportSubject: '[Bug] I want to report a bug',
    bugReportBody: 'Steps to reproduce\n1. \n2. \n3. \n\nWhat happens?\n\n\nWhat do you expect to happen instead?\n\n\n\n== PLEASE DONT PUT ANY KEYS HERE! ==\n\n\n## Log\n\nBelow is the log. It includes your interactions with your email provider from the point where you started the app for the last time. Login data and email content has been stripped. Any information provided by you will be used for the purpose of locating and fixing the bug you reported. It will be deleted subsequently. However, you can edit this log and/or remove log data in the event that something would show up.\n\nUser-Agent: {0}\nVersion: {1}\n\n',
    supportAddress: 'mail.support@invalid.org',
    connDocOffline: 'It appears that you are offline. Please retry when you are online.',
    connDocTlsWrongCert: 'A connection to {0} was rejected because the TLS certificate is invalid. Please have a look at the FAQ for information on how to fix this error.',
    connDocHostUnreachable: 'We could not establish a connection to {0}. Please check the server settings!',
    connDocHostTimeout: 'We could not establish a connection to {0} within {1} ms. Please check the server settings and encryption mode!',
    connDocAuthRejected: 'Your credentials for {0} were rejected. Please check your username and password!',
    connDocNoInbox: 'We could not detect an IMAP inbox folder on {0}.  Please have a look at the FAQ for information on how to fix this error.',
    connDocGenericError: 'There was an error connecting to {0}: {1}',
    logoutTitle: 'Logout',
    logoutMessage: 'Are you sure you want to log out?',
    removePreAuthAccountTitle: 'Remove account',
    removePreAuthAccountMessage: 'Are you sure you want to remove your account from this device?'
};
