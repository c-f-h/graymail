'use strict';

var uuid = require('node-uuid');

angular.module('woUtil', []).
factory('util', function() {
    return {
        
        validateEmailAddress: function(emailAddress) {
            var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            return re.test(emailAddress);
        },
        
        UUID: function() {
            return uuid.v4();
        },
        
        /**
         * Converts an ArrayBuffer to a binary String. This is a slower alternative to
         * conversion with arrBuf2Blob -> blob2BinStr, since these use native apis,
         * but it can be used on browsers without the BlodBuilder Api
         * @param buf [ArrayBuffer]
         * @return [String] a binary string with integer values (0..255) per character
         */
        arrBuf2BinStr: function(buf) {
            var b = new Uint8Array(buf);
            var str = '';
        
            for (var i = 0, len = b.length; i < len; i++) {
                str += String.fromCharCode(b[i]);
            }
        
            return str;
        }
    };
});

require('./axe');
require('./dummy');
require('./dialog');
require('./connection-doctor');
require('./update/update-handler');
require('./status');
require('./download');
require('./notification');

