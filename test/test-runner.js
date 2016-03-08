var jsdom = require('jsdom');
var Mocha = require('mocha');
var glob = require('glob');
var path = require('path');


if (process.argv.length != 3) {
    console.error('Please pass a path to the tests to be run.');
    process.exit(1);
}

var testsPath = path.resolve(process.argv[2]);


var vc = jsdom.createVirtualConsole().sendTo(console);

jsdom.env('<html><head><script></script></head><body></body></html>',
    [
      '../node_modules/sinon/pkg/sinon.js',
      '../node_modules/chai/chai.js',
      '../src/lib/angular/angular.js',
      '../src/lib/angular/angular-mocks.js',
      //'../src/lib/angular/angular-route.js',
      //'../src/lib/angular/angular-animate.js',
      //'../src/lib/ngtagsinput/ng-tags-input.min.js',
      //'../node_modules/ng-infinite-scroll/build/ng-infinite-scroll.min.js',
      '../src/lib/underscore/underscore.js',
      '../src/lib/lawnchair/lawnchair-git.js',
      '../src/lib/lawnchair/lawnchair-adapter-indexed-db-git.js',
      '../src/lib/lawnchair/lawnchair-adapter-memory.js'
    ].map(filename => path.join(__dirname, filename)),
    {
        'virtualConsole': vc,
        'created': function(err, window) {
            // set up needed hooks for ngMock
            window.mocha = new Mocha({ui:'bdd'});
            window.beforeEach = window.mocha.suite.beforeEach.bind(window.mocha.suite);
            window.afterEach = window.mocha.suite.afterEach.bind(window.mocha.suite);
        }
    },
    function(err, window) {
        if (err) {
            console.error(err);
            return;
        }

        // make everything in window available globally, as in browser
        Object.setPrototypeOf(global, window);

        window.forge = {};

        window.chrome = {};
        window.expect = window.chai.expect;

        window.resolves = function(val) {
            return Promise.resolve(val);
        };

        window.rejects = function(val) {
            return Promise.reject(val);
        };

        window.qMock = function(res, rej) {
            return new Promise(res, rej);
        }

        //chai.config.includeStack = true;

        // include modules
        require('../src/js/app-config');
        require('../src/js/util');
        require('../src/js/service');
        require('../src/js/email');

        var files = glob.sync('**/*js', {cwd: testsPath});

        for (var i in files) {
            mocha.addFile(path.join(testsPath, files[i]));
        }

        mocha.run(function(failures) {
            process.on('exit', function() {
                process.exit(failures);  // exit with non-zero status if there were failures
            });
        });
    }
);

