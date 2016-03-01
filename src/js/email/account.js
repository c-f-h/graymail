'use strict';

var ngModule = angular.module('woEmail');
ngModule.service('account', Account);
module.exports = Account;

function Account(auth, accountStore, email, outbox, updateHandler, dialog, util) {
    this._auth = auth;
    this._accountStore = accountStore;
    this._emailDao = email;
    this._outbox = outbox;
    this._updateHandler = updateHandler;
    this._dialog = dialog;
    this._accounts = []; // init accounts list
    this.util = util;
}

/**
 * Check if the account is already logged in.
 * @return {Boolean} if the account is logged in
 */
Account.prototype.isLoggedIn = function() {
    return (this._accounts.length > 0);
};

/**
 * Lists all of the current accounts connected to the app
 * @return {Array<Object>} The account objects containing folder and message objects
 */
Account.prototype.list = function() {
    return this._accounts;
};

/**
 * Fire up the database and initialize the email data access object
 */
Account.prototype.init = function(options) {
    var self = this;

    // account information for the email dao
    var account = {
        realname: options.realname,
        emailAddress: options.emailAddress
    };

    // Pre-Flight check: don't even start to initialize stuff if the email address is not valid
    if (!self.util.validateEmailAddress(options.emailAddress)) {
        return new Promise(function() {
            throw new Error('The user email address is invalid!');
        });
    }

    // Pre-Flight check: initialize and prepare user's local database
    return self._accountStore.init(options.emailAddress).then(function() {
        // Migrate the databases if necessary
        return self._updateHandler.update().catch(function(err) {
            throw new Error('Updating the internal database failed. Please reinstall the app! Reason: ' + err.message);
        });

    }).then(function() {
        // init the email data access object
        return self._emailDao.init({
            account: account
        }).then(function() {
            // Handle offline and online gracefully ... arm dom event
            window.addEventListener('online', self.onConnect.bind(self));
            window.addEventListener('offline', self.onDisconnect.bind(self));

            // add account object to the accounts array for the ng controllers
            self._accounts.push(account);

            return null; // keys;
        });
    });
};

/**
 * Event that is called when the user agent goes online. This create new instances of the imap-client and pgp-mailer and connects to the mail server.
 */
Account.prototype.onConnect = function(callback) {
    if (!this._emailDao || !this._emailDao._account) {
        // prevent connection infinite loop
        return;
    }

    this._emailDao.onConnect().then(callback).catch(callback);
};

/**
 * Event handler that is called when the user agent goes offline.
 */
Account.prototype.onDisconnect = function() {
    return this._emailDao.onDisconnect();
};

/**
 * Logout of an email account. Log the current user out by clear the app config store and deleting instances of imap-client and pgp-mailer.
 */
Account.prototype.logout = function() {
    var self = this;
    // clear app config store
    return self._auth.logout().then(function() {
        // clear the account DB, including keys and messages
        return self._accountStore.clear();

    }).then(function() {
        // delete instance of imap-client and pgp-mailer
        return self._emailDao.onDisconnect();

    }).then(function() {
        if (typeof window.chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
            // reload chrome app
            chrome.runtime.reload();
        } else {
            // navigate to login
            window.location.href = '/';
        }
    });
};
