'use strict';

var LoginCtrl = function($scope, $timeout, $location, updateHandler, account, auth, email, keychain, dialog, appConfig) {

    //
    // Scope functions
    //

    $scope.init = function() {
        // initialize the user account
        return auth.init().then(function() {
            // get email address
            return auth.getEmailAddress();

        }).then(function(info) {
            // check if account needs to be selected
            if (!info.emailAddress) {
                return $scope.goTo('/login-set-credentials');
            }

            // initiate the account by initializing the email dao and user storage
            return account.init({
                emailAddress: info.emailAddress,
                realname: info.realname
            }).then(function() {
                return $scope.goTo('/account');
            });

        }).catch(dialog.error);
    };

    $scope.goTo = function(location) {
        return $timeout(function() {
            $location.path(location);
        });
    };

    //
    // Start the app
    //

    // check for app update
    updateHandler.checkForUpdate();

    // init the app
    if (!appConfig.preventAutoStart) {
        $scope.init();
    }

};

module.exports = LoginCtrl;
