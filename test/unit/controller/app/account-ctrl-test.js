'use strict';

var AccountCtrl = require('../../../../src/js/controller/app/account'),
    PGP = require('../../../../src/js/crypto/pgp'),
    Download = require('../../../../src/js/util/download'),
    Auth = require('../../../../src/js/service/auth'),
    Dialog = require('../../../../src/js/util/dialog');

describe('Account Controller unit test', function() {
    var scope, accountCtrl,
        dummyFingerprint, expectedFingerprint,
        dummyKeyId, expectedKeyId,
        emailAddress, keySize, pgpStub, authStub, dialogStub, downloadStub;

    beforeEach(function() {
        pgpStub = sinon.createStubInstance(PGP);
        authStub = sinon.createStubInstance(Auth);
        dialogStub = sinon.createStubInstance(Dialog);
        downloadStub = sinon.createStubInstance(Download);

        dummyFingerprint = '3A2D39B4E1404190B8B949DE7D7E99036E712926';
        expectedFingerprint = '3A2D 39B4 E140 4190 B8B9 49DE 7D7E 9903 6E71 2926';
        dummyKeyId = '9FEB47936E712926';
        expectedKeyId = '6E712926';
        pgpStub.getFingerprint.returns(dummyFingerprint);
        pgpStub.getKeyId.returns(dummyKeyId);
        emailAddress = 'fred@foo.com';
        keySize = 1234;
        authStub.emailAddress = emailAddress;
        pgpStub.getKeyParams.returns({
            _id: dummyKeyId,
            fingerprint: dummyFingerprint,
            userId: emailAddress,
            bitSize: keySize
        });

        angular.module('accounttest', ['woServices']);
        angular.mock.module('accounttest');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            accountCtrl = $controller(AccountCtrl, {
                $scope: scope,
                $q: window.qMock,
                auth: authStub,
                pgp: pgpStub,
                download: downloadStub,
                dialog: dialogStub
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.eMail).to.equal(emailAddress);
            expect(scope.keyId).to.equal(expectedKeyId);
            expect(scope.fingerprint).to.equal(expectedFingerprint);
            expect(scope.keysize).to.equal(keySize);
        });
    });
});
