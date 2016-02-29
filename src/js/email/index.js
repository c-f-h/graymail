'use strict';

angular.module('woEmail', ['woAppConfig', 'woUtil', 'woServices', 'woCrypto']);

require('./mailreader');
require('./email');
require('./outbox');
require('./account');
require('./search');