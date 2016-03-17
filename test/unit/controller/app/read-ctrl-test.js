'use strict';

var Email = require('../../../../src/js/email/email'),
    ReadCtrl = require('../../../../src/js/controller/app/read'),
    Dialog = require('../../../../src/js/util/dialog'),
    Auth = require('../../../../src/js/service/auth'),
    Download = require('../../../../src/js/util/download'),
    Status = require('../../../../src/js/util/status');

describe('Read Controller unit test', function() {
    var scope, ctrl, emailMock, dialogMock, authMock, downloadMock, statusMock;

    beforeEach(function() {
        emailMock = sinon.createStubInstance(Email);
        dialogMock = sinon.createStubInstance(Dialog);
        authMock = sinon.createStubInstance(Auth);
        downloadMock = sinon.createStubInstance(Download);
        statusMock = sinon.createStubInstance(Status);

        angular.module('readtest', ['woServices']);
        angular.mock.module('readtest');
        angular.mock.inject(function($location, $rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            ctrl = $controller(ReadCtrl, {
                $scope: scope,
                $location: $location,
                $q: window.qMock,
                email: emailMock,
                download: downloadMock,
                dialog: dialogMock,
                status: statusMock
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.state.read).to.exist;
            expect(scope.state.read.open).to.be.false;
        });
    });

    describe('open/close read view', function() {
        it('should open/close', function() {
            expect(scope.state.read.open).to.be.false;
            scope.$broadcast('read', true);
            expect(scope.state.read.open).to.be.true;
            scope.$broadcast('read', false);
            expect(scope.state.read.open).to.be.false;
        });
    });

    describe('parseConversation', function() {
        it.skip('should work', function() {
            var body = 'foo\n' +
                '\n' +
                '> bar\n' +
                '>\n' +
                '> foofoo\n' +
                '>> foofoobar\n' +
                '\ncomment\n' +
                '>> barbar';

            var nodes = scope.parseConversation({
                body: body
            });
            expect(nodes).to.exist;

            var expectedJson = '{"children":["foo\\n",{"children":["bar\\n\\nfoofoo",{"children":["foofoobar"]}]},"\\ncomment",{"children":[{"children":["barbar"]}]}]}';
            var json = JSON.stringify(nodes);
            expect(json).to.equal(expectedJson);

            var expectedHtml = '<div class="view-read-body"><div class="line"><span>foo</span><br></div><div class="line empty-line"><span></span><br></div><div class="prev-message"><div class="line"><span>bar</span><br></div><div class="line empty-line"><span></span><br></div><div class="line"><span>foofoo</span><br></div></div><div class="prev-message"><div class="prev-message"><div class="line"><span>foofoobar</span><br></div></div></div><div class="line empty-line"><span></span><br></div><div class="line"><span>comment</span><br></div><div class="prev-message"><div class="prev-message"><div class="line"><span>barbar</span><br></div></div></div></div>';
            var html = scope.renderNodes(nodes);
            expect(html).to.equal(expectedHtml);
        });
    });

});
