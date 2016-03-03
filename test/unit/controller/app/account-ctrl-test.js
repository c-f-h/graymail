'use strict';

var AccountCtrl = require('../../../../src/js/controller/app/account'),
    Download = require('../../../../src/js/util/download'),
    Auth = require('../../../../src/js/service/auth'),
    Dialog = require('../../../../src/js/util/dialog');

describe('Account Controller unit test', function() {
    var scope, accountCtrl,
        emailAddress, authStub, dialogStub, downloadStub;

    beforeEach(function() {
        authStub = sinon.createStubInstance(Auth);
        dialogStub = sinon.createStubInstance(Dialog);
        downloadStub = sinon.createStubInstance(Download);

        emailAddress = 'fred@foo.com';
        authStub.emailAddress = emailAddress;

        angular.module('accounttest', ['woServices']);
        angular.mock.module('accounttest');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            accountCtrl = $controller(AccountCtrl, {
                $scope: scope,
                $q: window.qMock,
                auth: authStub,
                download: downloadStub,
                dialog: dialogStub
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.eMail).to.equal(emailAddress);
        });
    });
});
