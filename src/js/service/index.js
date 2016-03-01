'use strict';

angular.module('woServices', ['woAppConfig', 'woUtil', 'woCrypto']);

require('./rest');
require('./invitation');
require('./mail-config');
require('./oauth');
require('./hkp');
require('./admin');
require('./lawnchair');
require('./devicestorage');
require('./auth');
