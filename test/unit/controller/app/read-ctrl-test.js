'use strict';

var Email = require('../../../../src/js/email/email'),
    PGP = require('../../../../src/js/crypto/pgp'),
    ReadCtrl = require('../../../../src/js/controller/app/read'),
    Outbox = require('../../../../src/js/email/outbox'),
    Dialog = require('../../../../src/js/util/dialog'),
    Auth = require('../../../../src/js/service/auth'),
    Download = require('../../../../src/js/util/download');

describe('Read Controller unit test', function() {
    var scope, ctrl, emailMock, pgpMock, outboxMock, dialogMock, authMock, downloadMock;

    beforeEach(function() {
        pgpMock = sinon.createStubInstance(PGP);
        outboxMock = sinon.createStubInstance(Outbox);
        emailMock = sinon.createStubInstance(Email);
        dialogMock = sinon.createStubInstance(Dialog);
        authMock = sinon.createStubInstance(Auth);
        downloadMock = sinon.createStubInstance(Download);

        angular.module('readtest', ['woServices']);
        angular.mock.module('readtest');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            ctrl = $controller(ReadCtrl, {
                $scope: scope,
                $q: window.qMock,
                email: emailMock,
                outbox: outboxMock,
                pgp: pgpMock,
                download: downloadMock,
                auth: authMock,
                dialog: dialogMock
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.state.read).to.exist;
            expect(scope.state.read.open).to.be.false;
            expect(scope.state.read.toggle).to.exist;
        });
    });

    describe('open/close read view', function() {
        it('should open/close', function() {
            expect(scope.state.read.open).to.be.false;
            scope.state.read.toggle(true);
            expect(scope.state.read.open).to.be.true;
            scope.state.read.toggle(false);
            expect(scope.state.read.open).to.be.false;
        });
    });

    describe('getKeyId', function() {
        var address = 'asfd@asdf.com';

        it('should show searching on error', function(done) {
            expect(scope.keyId).to.equal('No key found.');

            scope.getKeyId(address).then(function() {
                expect(dialogMock.error.calledOnce).to.be.true;
                expect(scope.keyId).to.equal('Searching...');
                done();
            });
        });

        it('should show searching on error', function(done) {
            pgpMock.getFingerprint.returns('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

            scope.getKeyId(address).then(function() {
                expect(scope.keyId).to.equal('PGP key: XXXXXXXX');
                done();
            });
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
