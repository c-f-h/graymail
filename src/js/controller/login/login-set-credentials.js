'use strict';

var ENCRYPTION_METHOD_NONE = 0;
var ENCRYPTION_METHOD_STARTTLS = 1;
var ENCRYPTION_METHOD_TLS = 2;

var SetCredentialsCtrl = function($scope, $location, $routeParams, $q, auth, connectionDoctor) {
    !$routeParams.dev && !auth.isInitialized() && $location.path('/'); // init app

    //
    // Presets and Settings
    //
    
    auth.getEmailAddress().then(function(email) {
        $scope.emailAddress = email.emailAddress;
        $scope.realname = email.realname;
        
        return auth.getCredentials();
        
    }).then(function(cred) {
        if (cred.imap.auth.user && cred.imap.auth.user !== $scope.emailAddress) {
            $scope.username = cred.imap.user;
        }
        $scope.password = cred.imap.auth.pass;

        $scope.imapHost = cred.imap.host;
        $scope.imapPort = cred.imap.port;
        $scope.imapEncryption = parseTLSType(cred.imap);

        $scope.smtpHost = cred.smtp.host;
        $scope.smtpPort = cred.smtp.port;
        $scope.smtpEncryption = parseTLSType(cred.smtp);
        
        $scope.$apply();

        function parseTLSType(opts) {
            if (opts.secure)            { return ENCRYPTION_METHOD_TLS; }
            else if (opts.ignoreTLS)    { return ENCRYPTION_METHOD_NONE; }
            else                        { return ENCRYPTION_METHOD_STARTTLS; }
        }
    }).catch(function (err) {
        console.log(err);
    });
    
    //
    // Scope functions
    //

    $scope.test = function() {
        // parse the <select> dropdown lists
        var imapEncryption = parseInt($scope.imapEncryption, 10);
        var smtpEncryption = parseInt($scope.smtpEncryption, 10);

        // build credentials object
        var credentials = {
            emailAddress: $scope.emailAddress,
            username: $scope.username || $scope.emailAddress,
            realname: $scope.realname,
            password: $scope.password,
            xoauth2: auth.oauthToken,
            imap: {
                host: $scope.imapHost.toLowerCase(),
                port: $scope.imapPort,
                secure: imapEncryption === ENCRYPTION_METHOD_TLS,
                requireTLS: imapEncryption === ENCRYPTION_METHOD_STARTTLS,
                ignoreTLS: imapEncryption === ENCRYPTION_METHOD_NONE
            },
            smtp: {
                host: $scope.smtpHost.toLowerCase(),
                port: $scope.smtpPort,
                secure: smtpEncryption === ENCRYPTION_METHOD_TLS,
                requireTLS: smtpEncryption === ENCRYPTION_METHOD_STARTTLS,
                ignoreTLS: smtpEncryption === ENCRYPTION_METHOD_NONE
            }
        };
        
        // use the credentials in the connection doctor
        connectionDoctor.configure(credentials);
        
        // run connection doctor test suite
        return $q(function(resolve) {
            $scope.busy = true;
            resolve();

        }).then(function() {
            return connectionDoctor.check();

        }).then(function() {
            // persists the credentials and forwards to /login
            auth.setCredentials(credentials);
            return auth.storeCredentials();
        
        }).then(function() {
            $scope.busy = false;
            $location.path('/login');

        }).catch(function(err) {
            // display the error in the settings UI
            $scope.connectionError = err;
            $scope.busy = false;
        });
    };
};

module.exports = SetCredentialsCtrl;
