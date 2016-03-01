'use strict';

//
// Controller
//

var ContactsCtrl = function($scope) {

    //
    // scope state
    //

    $scope.state.contacts = {
        toggle: function(to) {
            $scope.state.lightbox = (to) ? 'contacts' : undefined;
            $scope.searchText = undefined;
            return $scope.listKeys();
        }
    };

    //
    // scope functions
    //

    $scope.listKeys = function() {
        // TODO fill $scope.keys
    };

    $scope.removeKey = function(/*key*/) {
        // TODO
        // update displayed keys
        // return $scope.listKeys();
    };
};

module.exports = ContactsCtrl;
