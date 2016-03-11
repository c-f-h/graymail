'use strict';

var LawnchairDAO = require('../../../src/js/service/lawnchair'),
    DeviceStorageDAO = require('../../../src/js/service/devicestorage');

var testUser = 'test@example.com';

describe('Device Storage DAO unit tests', function() {

    var storageDao, lawnchairDaoStub;

    beforeEach(function() {
        lawnchairDaoStub = sinon.createStubInstance(LawnchairDAO);
        storageDao = new DeviceStorageDAO(lawnchairDaoStub);
    });

    afterEach(function() {});

    describe('init', function() {
        it('should work', function() {
            lawnchairDaoStub.init.returns(resolves());

            return storageDao.init(testUser).then(function() {
                expect(lawnchairDaoStub.init.calledOnce).to.be.true;
            });
        });

        it('should fail', function() {
            lawnchairDaoStub.init.returns(rejects(new Error()));

            storageDao.init(testUser).catch(function(err) {
                expect(err).to.exist;
                expect(lawnchairDaoStub.init.calledOnce).to.be.true;
                done();
            });
        });
    });

    describe('#store', function() {
        it('should work', function() {
            lawnchairDaoStub.persist.returns(resolves(42));

            var obj = {foo: 42, bar: 'xyzzy'};
            var key = 'myKey';
            return storageDao.store(obj, key).then(function() {
                expect(lawnchairDaoStub.persist.calledWith(key, obj)).to.be.true;
            });
        })
    });

    describe('#storeList', function() {
        it('should fail', function(done) {
            var list = [{}];

            storageDao.storeList(list, '').catch(function(err) {
                expect(err).to.exist;
                done();
            });
        });

        it('should work with empty list', function() {
            var list = [];

            return storageDao.storeList(list, 'email');
        });

        it('should work', function() {
            lawnchairDaoStub.batch.returns(resolves());

            var list = [{
                foo: 'bar'
            }];

            return storageDao.storeList(list, 'email').then(function() {
                expect(lawnchairDaoStub.batch.calledOnce).to.be.true;
            });
        });
    });

    describe('remove list', function() {
        it('should work', function(done) {
            lawnchairDaoStub.removeList.returns(resolves());

            storageDao.removeList('email').then(function() {
                expect(lawnchairDaoStub.removeList.calledOnce).to.be.true;
                done();
            });
        });
    });

    describe('list items', function() {
        it('should work', function(done) {
            lawnchairDaoStub.list.returns(resolves());

            storageDao.listItems('email').then(function() {
                expect(lawnchairDaoStub.list.calledOnce).to.be.true;
                done();
            });
        });
    });

    describe('clear', function() {
        it('should work', function(done) {
            lawnchairDaoStub.clear.returns(resolves());

            storageDao.clear().then(function() {
                expect(lawnchairDaoStub.clear.calledOnce).to.be.true;
                done();
            });
        });
    });

});
