'use strict';

var OutboxBO = require('../../../src/js/email/outbox'),
    EmailDAO = require('../../../src/js/email/email'),
    DeviceStorageDAO = require('../../../src/js/service/devicestorage');

describe('Outbox unit test', function() {
    var outbox, emailDaoStub, devicestorageStub,
        dummyUser = 'spiderpig@springfield.com';

    chai.config.includeStack = true;

    beforeEach(function() {
        emailDaoStub = sinon.createStubInstance(EmailDAO);
        emailDaoStub._account = {
            emailAddress: dummyUser,
            folders: [{
                type: 'Outbox'
            }],
            online: true
        };
        devicestorageStub = sinon.createStubInstance(DeviceStorageDAO);
        outbox = new OutboxBO(emailDaoStub, devicestorageStub);
    });

    afterEach(function() {});

    describe('start/stop checking', function() {
        it('should work', function() {
            function onOutboxUpdate(err) {
                expect(err).to.not.exist;
            }

            outbox.startChecking(onOutboxUpdate);
            expect(outbox._intervalId).to.exist;

            outbox.stopChecking();
            expect(outbox._intervalId).to.not.exist;
        });
    });

    describe('put', function() {
        beforeEach(function() {
            sinon.stub(outbox, '_processOutbox');
        });
        afterEach(function() {
            outbox._processOutbox.restore();
        });

        it('should throw error for message without recipients', function(done) {
            var mail = {
                from: [{
                    name: 'member',
                    address: 'member@whiteout.io'
                }],
                to: [],
                cc: [],
                bcc: []
            };

            outbox.put(mail).catch(function(err) {
                expect(err).to.exist;
                done();
            });
        });

        it('should store a mail', function() {
            var mail = {
                from: [{
                    name: 'member',
                    address: 'member@whiteout.io'
                }],
                to: [{
                    name: 'member',
                    address: 'member'
                }, {
                    name: 'notamember',
                    address: 'notamember'
                }],
                cc: [],
                bcc: []
            };

            devicestorageStub.storeList.withArgs([mail]).returns(resolves());

            return outbox.put(mail).then(function() {
                expect(devicestorageStub.storeList.calledOnce).to.be.true;
            });
        });
    });

    describe('process outbox', function() {
        it('should send to registered users and update pending mails', function(done) {
            var from, member, invited, notinvited, newlyjoined, dummyMails, newlyjoinedKey;

            from = [{
                name: 'member',
                address: 'member@whiteout.io'
            }];
            member = {
                id: '12',
                from: from,
                to: [{
                    name: 'member',
                    address: 'member'
                }],
                publicKeysArmored: ['ARMORED KEY OF MEMBER'],
                unregisteredUsers: []
            };
            invited = {
                id: '34',
                from: from,
                to: [{
                    name: 'invited',
                    address: 'invited'
                }],
                publicKeysArmored: [],
                unregisteredUsers: [{
                    name: 'invited',
                    address: 'invited'
                }]
            };
            notinvited = {
                id: '56',
                from: from,
                to: [{
                    name: 'notinvited',
                    address: 'notinvited'
                }],
                publicKeysArmored: [],
                unregisteredUsers: [{
                    name: 'notinvited',
                    address: 'notinvited'
                }]
            };
            newlyjoined = {
                id: '78',
                from: from,
                to: [{
                    name: 'newlyjoined',
                    address: 'newlyjoined'
                }],
                publicKeysArmored: [],
                unregisteredUsers: [{
                    name: 'newlyjoined',
                    address: 'newlyjoined'
                }]
            };
            newlyjoinedKey = {
                publicKey: 'THIS IS THE NEWLY JOINED PUBLIC KEY!'
            };

            dummyMails = [member, invited, notinvited, newlyjoined];

            devicestorageStub.listItems.returns(resolves(dummyMails));

            emailDaoStub.sendPlaintext.returns(resolves());

            devicestorageStub.removeList.returns(resolves());

            outbox._processOutbox(function(err) {
                expect(err).to.not.exist;
                expect(outbox._outboxBusy).to.be.false;
                expect(emailDaoStub.sendPlaintext.callCount).to.equal(4);
                expect(devicestorageStub.listItems.callCount).to.equal(1);
                expect(devicestorageStub.removeList.callCount).to.equal(4);

                done();
            });
        });

        it('should not process outbox in offline mode', function(done) {
            emailDaoStub._account.online = false;
            devicestorageStub.listItems.returns(resolves([{}]));

            outbox._processOutbox(function(err) {
                expect(err).to.not.exist;
                expect(devicestorageStub.listItems.callCount).to.equal(1);
                expect(outbox._outboxBusy).to.be.false;
                done();
            });
        });
    });
});
