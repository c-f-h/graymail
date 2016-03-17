'use strict';

var Account = require('../../../src/js/email/account'),
    Auth = require('../../../src/js/service/auth'),
    DeviceStorageDAO = require('../../../src/js/service/devicestorage'),
    Email = require('../../../src/js/email/email'),
    UpdateHandler = require('../../../src/js/util/update/update-handler');

describe('Account Service unit test', function() {
    var account, authStub, emailStub, devicestorageStub, updateHandlerStub,
        realname = 'John Doe',
        dummyUser = 'spiderpig@springfield.com';

    chai.config.includeStack = true;

    beforeEach(function() {
        authStub = sinon.createStubInstance(Auth);
        devicestorageStub = sinon.createStubInstance(DeviceStorageDAO);
        emailStub = sinon.createStubInstance(Email);
        updateHandlerStub = sinon.createStubInstance(UpdateHandler);
        account = new Account(authStub, devicestorageStub, emailStub, updateHandlerStub);
    });

    afterEach(function() {});

    describe('isLoggedIn', function() {
        it('should be logged in', function() {
            account._accounts = [{}];
            expect(account.isLoggedIn()).to.be.true;
        });
        it('should not be logged in', function() {
            account._accounts = [];
            expect(account.isLoggedIn()).to.be.false;
        });
    });

    describe('list', function() {
        it('should work', function() {
            var testAccounts = [{
                foo: 'bar'
            }];
            account._accounts = testAccounts;
            expect(account.list()).to.deep.equal(testAccounts);
        });
    });

    describe('init', function() {
        it('should fail for invalid email address', function() {
            account.init({
                emailAddress: dummyUser.replace('@'),
                realname: realname
            }).catch(function onInit(err) {
                expect(err).to.exist;
            });
        });

        it('should fail for _accountStore.init', function() {
            devicestorageStub.init.returns(rejects(new Error('asdf')));

            account.init({
                emailAddress: dummyUser,
                realname: realname
            }).catch(function onInit(err) {
                expect(err.message).to.match(/asdf/);
            });
        });

        it('should fail for _updateHandler.update', function() {
            devicestorageStub.init.returns(resolves());
            updateHandlerStub.update.returns(rejects(new Error('asdf')));

            account.init({
                emailAddress: dummyUser,
                realname: realname
            }).catch(function onInit(err) {
                expect(err.message).to.match(/Updating/);
            });
        });

        it('should fail for _emailDao.init', function() {
            devicestorageStub.init.returns(resolves());
            updateHandlerStub.update.returns(resolves());
            emailStub.init.returns(rejects(new Error('asdf')));

            account.init({
                emailAddress: dummyUser,
                realname: realname
            }).catch(function(err) {
                expect(err.message).to.match(/asdf/);
            });
        });

        it('should work', function() {
            var storedKeys = {
                publicKey: 'publicKey',
                privateKey: 'privateKey'
            };

            devicestorageStub.init.returns(resolves());
            updateHandlerStub.update.returns(resolves());
            emailStub.init.returns(resolves());

            account.init({
                emailAddress: dummyUser,
                realname: realname
            }).then(function(keys) {
                expect(keys).to.equal(storedKeys);
                expect(emailStub.init.calledOnce).to.be.true;
                expect(account._accounts.length).to.equal(1);
            });
        });
    });

    describe('logout', function() {
        // cannot test the good case here or the browser will refresh during the test.

        it('should fail due to _auth.logout', function(done) {
            authStub.logout.returns(rejects(new Error('asdf')));

            account.logout().catch(function(err) {
                expect(err.message).to.match(/asdf/);
                expect(authStub.logout.calledOnce).to.be.true;
                done();
            });
        });

        it('should fail due to _accountStore.clear', function(done) {
            authStub.logout.returns(resolves());
            devicestorageStub.clear.returns(rejects(new Error('asdf')));

            account.logout().catch(function(err) {
                expect(err.message).to.match(/asdf/);
                expect(devicestorageStub.clear.calledOnce).to.be.true;
                expect(authStub.logout.calledOnce).to.be.true;
                done();
            });
        });

        it('should fail due to _emailDao.disconnectImap', function(done) {
            authStub.logout.returns(resolves());
            devicestorageStub.clear.returns(resolves());
            emailStub.disconnectImap.returns(rejects(new Error('asdf')));

            account.logout().catch(function(err) {
                expect(err.message).to.match(/asdf/);
   
                expect(emailStub.disconnectImap.calledOnce).to.be.true;
                expect(authStub.logout.calledOnce).to.be.true;
                expect(devicestorageStub.clear.calledOnce).to.be.true;
   
                done();
            });
        });
    });

});
