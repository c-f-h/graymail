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

    $scope.eMail = userId;

};

module.exports = AccountCtrl;
