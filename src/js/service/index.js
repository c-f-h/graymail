'use strict';

angular.module('woServices', ['woAppConfig', 'woUtil', 'woCrypto']);

require('./rest');
require('./oauth');
require('./lawnchair');
require('./devicestorage');
require('./auth');
