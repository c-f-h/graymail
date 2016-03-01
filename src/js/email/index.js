'use strict';

angular.module('woEmail', ['woAppConfig', 'woUtil', 'woServices']);

require('./mailreader');
require('./email');
require('./outbox');
require('./account');
require('./search');
