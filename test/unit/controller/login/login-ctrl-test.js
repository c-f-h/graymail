'use strict';

var LoginCtrl = require('../../../../src/js/controller/login/login'),
    Email = require('../../../../src/js/email/email'),
    Account = require('../../../../src/js/email/account'),
    Dialog = require('../../../../src/js/util/dialog'),
    UpdateHandler = require('../../../../src/js/util/update/update-handler'),
    Auth = require('../../../../src/js/service/auth');

describe('Login Controller unit test', function() {
    var scope, location, ctrl,
        emailMock, authMock, accountMock, dialogMock, updateHandlerMock, goToStub,
        emailAddress = 'fred@foo.com';

    beforeEach(function() {
        emailMock = sinon.createStubInstance(Email);
        accountMock = sinon.createStubInstance(Account);
        authMock = sinon.createStubInstance(Auth);
        dialogMock = sinon.createStubInstance(Dialog);
        updateHandlerMock = sinon.createStubInstance(UpdateHandler);

        location = {
            path: function() {}
        };

        authMock.emailAddress = emailAddress;

        angular.module('login-test', ['woServices', 'woEmail', 'woUtil']);
        angular.mock.module('login-test');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            scope.form = {};

            ctrl = $controller(LoginCtrl, {
                $scope: scope,
                $location: location,
                updateHandler: updateHandlerMock,
                account: accountMock,
                auth: authMock,
                email: emailMock,
                dialog: dialogMock,
                appConfig: {
                    preventAutoStart: true
                }
            });
        });

        scope.goTo = function() {};
        goToStub = sinon.stub(scope, 'goTo');
    });

    afterEach(function() {});

    it('should fail for auth.getEmailAddress', function(done) {
        authMock.init.returns(resolves());
        authMock.getEmailAddress.returns(rejects(new Error()));

        scope.init().then(function() {
            expect(updateHandlerMock.checkForUpdate.calledOnce).to.be.true;
            expect(authMock.init.calledOnce).to.be.true;
            expect(dialogMock.error.calledOnce).to.be.true;
            done();
        });
    });

    it('should fail for auth.init', function(done) {
        authMock.init.returns(rejects(new Error()));
        authMock.getEmailAddress.returns(resolves({
            emailAddress: emailAddress
        }));

        scope.init().then(function() {
            expect(authMock.init.calledOnce).to.be.true;
            expect(accountMock.init.called).to.be.false;
            expect(dialogMock.error.calledOnce).to.be.true;
            done();
        });
    });

    it('should fail for account.init', function(done) {
        authMock.init.returns(resolves());
        authMock.getEmailAddress.returns(resolves({
            emailAddress: emailAddress
        }));
        accountMock.init.returns(rejects());

        scope.init().then(function() {
            expect(dialogMock.error.calledOnce).to.be.true;
            done();
        });
    });

    it('should redirect to /login-set-credentials', function(done) {
        authMock.init.returns(resolves());
        authMock.getEmailAddress.returns(resolves({}));

        scope.init().then(function() {
            expect(goToStub.withArgs('/login-set-credentials').called).to.be.true;
            expect(goToStub.calledOnce).to.be.true;
            done();
        });
    });

    it('should redirect to /account', function(done) {
        authMock.init.returns(resolves());
        authMock.getEmailAddress.returns(resolves({
            emailAddress: emailAddress
        }));
        accountMock.init.returns(resolves());

        scope.init().then(function() {
            expect(goToStub.withArgs('/account').called).to.be.true;
            expect(goToStub.calledOnce).to.be.true;
            done();
        });
    });

});
