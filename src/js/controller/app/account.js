'use strict';

var AccountCtrl = function($scope, auth) {
    var userId = auth.emailAddress;
    if (!userId) {
        return;
    }

    //
    // scope state
    //

    $scope.state.account = {
        toggle: function(to) {
            $scope.state.lightbox = (to) ? 'account' : undefined;
        }
    };

    //
    // scope variables
    //

    //var keyParams = pgp.getKeyParams();

    $scope.eMail = userId;
    $scope.keyId = null; //keyParams._id.slice(8);
    //var fpr = keyParams.fingerprint;
    $scope.fingerprint = null; //fpr.slice(0, 4) + ' ' + fpr.slice(4, 8) + ' ' + fpr.slice(8, 12) + ' ' + fpr.slice(12, 16) + ' ' + fpr.slice(16, 20) + ' ' + fpr.slice(20, 24) + ' ' + fpr.slice(24, 28) + ' ' + fpr.slice(28, 32) + ' ' + fpr.slice(32, 36) + ' ' + fpr.slice(36);
    $scope.keysize = null; //keyParams.bitSize;
    $scope.publicKeyUrl = null; //appConfig.config.keyServerUrl + '/' + userId;

};

module.exports = AccountCtrl;
