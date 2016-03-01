'use strict';

// we don't use Forge on Chrome, so we just create an empty object
// to keep tcp-socket from throwing an error
window.forge = {};

//
// Angular app config
//

var axe = require('axe-logger');

// include angular modules
require('./app-config');
require('./directive');
require('./util');
require('./crypto');
require('./service');
require('./email');

// init main angular module including dependencies
var app = angular.module('mail', [
    'ngRoute',
    'ngAnimate',
    'ngTagsInput',
    'woAppConfig',
    'woDirectives',
    'woUtil',
    'woCrypto',
    'woServices',
    'woEmail',
    'infinite-scroll'
]);

// set router paths
app.config(function($routeProvider, $animateProvider) {
    $routeProvider.when('/login', {
        templateUrl: 'tpl/login.html',
        controller: require('./controller/login/login')
    });
    $routeProvider.when('/login-set-credentials', {
        templateUrl: 'tpl/login-set-credentials.html',
        controller: require('./controller/login/login-set-credentials')
    });
    $routeProvider.when('/account', {
        templateUrl: 'tpl/desktop.html',
        controller: require('./controller/app/navigation'),
        reloadOnSearch: false // don't reload controllers in main app when query params change
    });
    $routeProvider.otherwise({
        redirectTo: '/login'
    });

    // activate ngAnimate for whitelisted classes only
    $animateProvider.classNameFilter(/lightbox/);
});

app.run(function($rootScope) {
    // global state... inherited to all child scopes
    $rootScope.state = {};
    // attach fastclick
    FastClick.attach(document.body);
});

// inject controllers from ng-included view templates
app.controller('ReadCtrl', require('./controller/app/read'));
app.controller('WriteCtrl', require('./controller/app/write'));
app.controller('MailListCtrl', require('./controller/app/mail-list'));
app.controller('AccountCtrl', require('./controller/app/account'));
app.controller('SetPassphraseCtrl', require('./controller/app/set-passphrase'));
app.controller('ContactsCtrl', require('./controller/app/contacts'));
app.controller('AboutCtrl', require('./controller/app/about'));
app.controller('DialogCtrl', require('./controller/app/dialog'));
app.controller('ActionBarCtrl', require('./controller/app/action-bar'));
app.controller('StatusDisplayCtrl', require('./controller/app/status-display'));

//
// Manual angular bootstraping
//

// are we running in a cordova app or in a browser environment?
if (window.cordova) {
    // wait for 'deviceready' event to make sure plugins are loaded
    axe.debug('Assuming Cordova environment...');
    document.addEventListener('deviceready', bootstrap, false);
} else {
    // No need to wait on events... just start the app
    axe.debug('Assuming Browser environment...');
    bootstrap();
}

function bootstrap() {
    angular.element(document).ready(function() {
        angular.bootstrap(document, ['mail']);
    });
}
