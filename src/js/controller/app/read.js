'use strict';

//
// Controller
//

var ReadCtrl = function($scope, $location, $q, email, download, dialog, status) {

    //
    // scope state
    //

    $scope.state.read = {
        open: false
    };

    function toggle(to) {
        $scope.state.read.open = to;
    }

    $scope.$on('read', function(e, state) {
        toggle(state);
    });

    //
    // url/history handling
    //

    // read state url watcher
    $scope.loc = $location;
    $scope.$watch('(loc.search()).uid', function(uid) {
        // synchronize the url to the scope state
        toggle(!!uid);
    });
    $scope.$watch('state.read.open', function(value) {
        // close read mode by navigating to folder view
        if (!value) {
            $location.search('uid', null);
        }
    });

    //
    // scope functions
    //

    /**
     * Close read mode and return to mail-list
     */
    $scope.close = function() {
        status.setReading(false);
    };

    $scope.download = function(attachment) {
        // download file to disk if content is available
        if (attachment.content) {
            download.createDownload({
                content: attachment.content,
                filename: attachment.filename,
                contentType: attachment.mimeType
            });
            return;
        }

        var folder = $scope.state.nav.currentFolder;
        var message = $scope.state.mailList.selected;

        return $q(function(resolve) {
            resolve();

        }).then(function() {
            return email.getAttachment({
                folder: folder,
                uid: message.uid,
                attachment: attachment
            });

        }).catch(dialog.error);
    };
};

module.exports = ReadCtrl;