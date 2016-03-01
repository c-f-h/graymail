'use strict';

angular.module('woServices', ['woAppConfig', 'woUtil', 'woCrypto']);

require('./rest');
require('./mail-config');
require('./oauth');
require('./hkp');
require('./lawnchair');
require('./devicestorage');
require('./auth');
