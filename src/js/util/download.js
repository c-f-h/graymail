'use strict';

var ngModule = angular.module('woUtil');
ngModule.service('download', Download);
module.exports = Download;


/**
 * A download helper.
 */
function Download() {
}

/**
 * Create download link and click on it.
 */
Download.prototype.createDownload = function(options) {
    var contentType = options.contentType || 'application/octet-stream';
    var filename = options.filename || 'file';
    var content = options.content;
    var a = document.createElement('a');

    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = window.URL.createObjectURL(new Blob([content], {
        type: contentType
    }));
    a.download = filename;
    a.click();
    setTimeout(function() {
        window.URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
    }, 10); // arbitrary, just get it off the main thread
};