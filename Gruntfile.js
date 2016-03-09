'use strict';

require('shelljs/global');

var fs = require('fs');
var browserify = require('browserify');
var async = require('async');

function doBrowserify(target, src, done) {
    var b = browserify(src, {
        debug: true,
        //fullPaths: true       // only needed for discify
    });

    ['openpgp', 'node-forge', 'net', 'tls', 'crypto'].
        forEach(f => b.exclude(f));

    b.ignore('buffer');

    // shim out the stringencoding module for the browser
    b.require('./src/js/stringencoding.js', {expose: 'emailjs-stringencoding'});

    b.bundle().pipe(fs.createWriteStream(target)).on('finish', done);
}

function runTests() {
    var result1 = !exec('node test/test-runner.js test/unit');
    var result2 = !exec('node test/test-runner.js test/integration');
    return result1 && result2;
}

module.exports = function(grunt) {

    require('time-grunt')(grunt);

    var version = grunt.option('release'),
        zipName = (version) ? version : 'DEV';

    // Project configuration.
    grunt.initConfig({

        // General

        clean: {
            dist: ['dist', 'compile', 'test/lib', 'test/integration/src'],
            release: ['dist/**/*.browserified.js', 'dist/**/*.js.map', 'dist/js/app.templates.js']
        },

        copy: {
            font: {
                expand: true,
                cwd: 'src/font/',
                src: ['*'],
                dest: 'dist/font/'
            },
            img: {
                expand: true,
                cwd: 'src/img/',
                src: ['*'],
                dest: 'dist/img/'
            },
            tpl: {
                expand: true,
                cwd: 'src/tpl/',
                src: ['read-sandbox.html'],
                dest: 'dist/tpl/'
            },
            app: {
                expand: true,
                cwd: 'src/',
                src: ['*.js', '*.json', 'manifest.*'],
                dest: 'dist/'
            }
        },

        // Stylesheets

        sass: {
            dist: {
                files: {
                    'src/css/read-sandbox.css': 'src/sass/read-sandbox.scss',
                    'src/css/all.css': 'src/sass/all.scss'
                }
            },
            styleguide: {
                files: {
                    'src/css/styleguide.css': 'src/sass/styleguide.scss'
                }
            }
        },
        autoprefixer: {
            options: {
                browsers: ['last 2 versions']
            },
            dist: {
                files: {
                    'src/css/read-sandbox.css': 'src/css/read-sandbox.css',
                    'src/css/all.css': 'src/css/all.css'
                }
            },
            styleguide: {
                files: {
                    'src/css/styleguide.css': 'src/css/styleguide.css'
                }
            }
        },
        csso: {
            dist: {
                files: {
                    'dist/css/read-sandbox.min.css': 'src/css/read-sandbox.css',
                    'dist/css/all.min.css': 'src/css/all.css'
                }
            },
            styleguide: {
                files: {
                    'dist/styleguide/css/styleguide.min.css': 'src/css/styleguide.css'
                }
            }
        },

        // JavaScript

        jshint: {
            all: ['Gruntfile.js', 'src/*.js', 'src/js/**/*.js', 'test/unit/**/*-test.js', 'test/integration/**/*-test.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        exorcise: {
            app: {
                files: {
                    'dist/js/app.browserified.js.map': ['dist/js/app.browserified.js'],
                }
            },
        },

        ngtemplates: {
            mail: {
                src: [
                    'tpl/**/*.html'
                ],
                dest: 'dist/js/app.templates.js',
                cwd: 'src/',
                options: {
                    htmlmin: {
                        collapseWhitespace: true,
                        removeComments: true // we do not use comment directives
                    }
                }
            }
        },

        concat: {
            options: {
                separator: ';\n',
                sourceMap: true
            },
            app: {
                src: [
                    'src/lib/underscore/underscore.js',
                    'node_modules/jquery/dist/jquery.min.js',
                    'src/lib/angular/angular.js',
                    'src/lib/angular/angular-route.js',
                    'src/lib/angular/angular-animate.js',
                    'src/lib/ngtagsinput/ng-tags-input.min.js',
                    'node_modules/ng-infinite-scroll/build/ng-infinite-scroll.min.js',
                    'node_modules/iframe-resizer/js/iframeResizer.min.js',
                    'src/lib/fastclick/fastclick.js',
                    'src/lib/lawnchair/lawnchair-git.js',
                    'src/lib/lawnchair/lawnchair-adapter-indexed-db-git.js',
                    'dist/js/app.browserified.js',
                    '<%= ngtemplates.mail.dest %>'
                ],
                dest: 'dist/js/app.min.js',
                options: {
                    sourceMapName: 'dist/js/app.js.map'
                }
            },
            readSandbox: {
                src: [
                    'node_modules/dompurify/src/purify.js',
                    'node_modules/iframe-resizer/js/iframeResizer.contentWindow.min.js',
                    'src/js/controller/app/read-sandbox.js'
                ],
                dest: 'dist/js/read-sandbox.min.js'
            },
            mailreaderWorker: {
                src: ['dist/js/mailreader-parser-worker.browserified.js'],
                dest: 'dist/js/mailreader-parser-worker.min.js'
            },
            compressionWorker: {
                src: ['dist/js/browserbox-compression-worker.browserified.js'],
                dest: 'dist/js/browserbox-compression-worker.min.js'
            },
        },

        uglify: {
            app: {
                files: {
                    'dist/js/app.min.js': ['dist/js/app.min.js']
                },
                options: {
                    mangle: false,
                    sourceMap: true,
                    sourceMapIn: 'dist/js/app.js.map',
                    sourceMapIncludeSources: true,
                    sourceMapName: 'dist/js/app.min.js.map'
                }
            },
            readSandbox: {
                files: {
                    'dist/js/read-sandbox.min.js': ['dist/js/read-sandbox.min.js']
                },
                options: {
                    sourceMap: true,
                    sourceMapName: 'dist/js/read-sandbox.min.js.map'
                }
            },
            mailreaderWorker: {
                files: {
                    'dist/js/mailreader-parser-worker.min.js': ['dist/js/mailreader-parser-worker.min.js']
                },
                options: {
                    sourceMap: true,
                    sourceMapName: 'dist/js/mailreader-parser-worker.min.js.map'
                }
            },
            compressionWorker: {
                files: {
                    'dist/js/browserbox-compression-worker.min.js': ['dist/js/browserbox-compression-worker.min.js']
                },
                options: {
                    sourceMap: true,
                    sourceMapName: 'dist/js/browserbox-compression-worker.min.js.map'
                }
            }
        },

        // Assets

        svgmin: {
            options: {
                plugins: [{
                    removeViewBox: false
                }, {
                    removeUselessStrokeAndFill: false
                }]
            },
            icons: {
                files: [{
                    expand: true,
                    src: ['img/icons/*.svg', '!img/icons/all.svg'],
                    cwd: 'src/',
                    dest: 'compile/'
                }]
            }
        },
        svgstore: {
            options: {
                prefix: 'icon-',
                svg: {
                    viewBox: '0 0 100 100',
                    xmlns: 'http://www.w3.org/2000/svg'
                },
                cleanup: ['fill', 'stroke']
            },
            icons: {
                files: {
                    'src/img/icons/all.svg': ['compile/img/icons/*.svg'],
                }
            }
        },
        'string-replace': {
            index: {
                files: {
                    'dist/index.html': 'src/index.html'
                },
                options: {
                    replacements: [{
                        pattern: /<!-- @import (.*?) -->/ig,
                        replacement: function(match, p1) {
                            return grunt.file.read('src/' + p1);
                        }
                    }]
                }
            }
        },

        // Styleguide

        assemble: {
            options: {
                assets: 'dist',
                layoutdir: 'src/styleguide/layouts',
                layout: 'default.hbs',
                partials: ['src/styleguide/blocks/**/*.hbs'],
                helpers: [
                    'handlebars-helper-compose',
                    'src/styleguide/helpers/**/*.js'
                ],
                data: [
                    'dist/manifest.json'
                ],
                flatten: true
            },
            styleguide: {
                files: [{
                    'dist/styleguide/': ['src/styleguide/*.hbs']
                }]
            }
        },

        // Utilities

        watch: {
            css: {
                files: ['src/sass/**/*.scss'],
                tasks: ['dist-css', 'dist-styleguide']
            },
            styleguide: {
                files: ['src/styleguide/**/*.hbs', 'src/styleguide/**/*.js'],
                tasks: ['dist-styleguide']
            },
            jsApp: {
                files: ['src/js/**/*.js', 'src/*.html', 'src/tpl/**/*.html'],
                tasks: ['dist-js-app']
            },
            icons: {
                files: ['src/index.html', 'src/img/icons/*.svg', '!src/img/icons/all.svg'],
                tasks: ['svgmin', 'svgstore', 'string-replace', 'dist-styleguide']
            },
            lib: {
                files: ['src/lib/**/*.js'],
                tasks: ['copy:lib']
            },
            app: {
                files: ['src/*.js', 'src/*.html', 'src/tpl/**/*.html', 'src/**/*.json', 'src/manifest.*', 'src/img/**/*', 'src/font/**/*'],
                tasks: ['copy:app', 'copy:tpl', 'copy:img', 'copy:font', 'manifest-dev']
            }
        },

        // Deployment

        compress: {
            main: {
                options: {
                    mode: 'zip',
                    archive: 'release/whiteout-mail_' + zipName + '.zip'
                },
                expand: true,
                cwd: 'dist/',
                src: ['**/*'],
                dest: 'release/'
            }
        }
    });

    // Load the plugin(s)
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-csso');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-autoprefixer');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-exorcise');
    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-svgmin');
    grunt.loadNpmTasks('grunt-svgstore');
    grunt.loadNpmTasks('grunt-angular-templates');
    grunt.loadNpmTasks('assemble');

    grunt.registerTask('browserify_app', function() {
        var done = this.async();
        doBrowserify('dist/js/app.browserified.js', 'src/js/app.js', done);
    });

    grunt.registerTask('browserify', function() {
        mkdir('-p', 'dist/js');
        var done = this.async();
        async.parallel([
        doBrowserify.bind(null, 'dist/js/app.browserified.js',
                                './src/js/app.js'),
        doBrowserify.bind(null, 'dist/js/mailreader-parser-worker.browserified.js',
                                './node_modules/mailreader/src/mailreader-parser-worker-browserify.js'),
        doBrowserify.bind(null, 'dist/js/browserbox-compression-worker.browserified.js',
                                './node_modules/emailjs-imap-client/src/emailjs-imap-client-compression-worker.js')
        ], done);
    });

    // Build tasks
    grunt.registerTask('dist-css', ['sass:dist', 'autoprefixer:dist', 'csso:dist']);
    grunt.registerTask('dist-js', ['browserify', 'exorcise', 'ngtemplates', 'concat' /*, 'uglify'*/]);
    grunt.registerTask('dist-js-app', [
        'browserify_app',
        'exorcise:app',
        'ngtemplates',
        'concat:app',
        'concat:readSandbox'
    ]);
    grunt.registerTask('dist-copy', ['copy']);
    grunt.registerTask('dist-assets', ['svgmin', 'svgstore', 'string-replace']);
    grunt.registerTask('dist-styleguide', ['sass:styleguide', 'autoprefixer:styleguide', 'csso:styleguide', 'assemble:styleguide']);
    // generate styleguide after manifest to forward version number to styleguide
    grunt.registerTask('dist', ['clean:dist', 'dist-css', 'dist-js', 'dist-assets', 'dist-copy']);
    grunt.registerTask('dist-all', ['dist', 'dist-styleguide']);

    // run JSHint and unit/integration tests
    grunt.registerTask('run-tests', runTests);
    grunt.registerTask('test', ['jshint', 'run-tests']);

    //
    // Release tasks for Chrome App Release Channels
    //

    grunt.registerTask('manifest-dev', function() {
        patchManifest({
            suffix: ' (DEV)',
            version: '9999.9999.9999'
        });
    });
    grunt.registerTask('manifest-test', function() {
        if (!version) {
            throw new Error('You must specify the version: "--release=1.0.0"');
        }

        patchManifest({
            suffix: ' (TEST)',
            client_id: '440907777130-bfpgo5fbo4f7hetrg3hn57qolrtubs0u.apps.googleusercontent.com',
            version: version,
            deleteKey: true
        });
    });
    grunt.registerTask('manifest-prod', function() {
        if (!version) {
            throw new Error('You must specify the version: "--release=1.0.0"');
        }

        patchManifest({
            version: version,
            deleteKey: true
        });
    });

    function patchManifest(options) {
        var fs = require('fs'),
            path = './dist/manifest.json',
            manifest = require(path);

        if (options.version) {
            manifest.version = options.version;
        }
        if (options.suffix) {
            manifest.name += options.suffix;
        }
        if (options.client_id) {
            manifest.oauth2.client_id = options.client_id;
        }
        if (options.deleteKey) {
            delete manifest.key;
        }

        fs.writeFileSync(path, JSON.stringify(manifest, null, 2));
    }

    grunt.registerTask('release-dev', ['dist', 'manifest-dev', 'compress']);
    grunt.registerTask('release-test', ['dist', 'manifest-test', 'clean:release', 'compress']);
    grunt.registerTask('release-prod', ['dist', 'manifest-prod', 'clean:release', 'compress']);
    grunt.registerTask('default', ['release-dev']);

};
