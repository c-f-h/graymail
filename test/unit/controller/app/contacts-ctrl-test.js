'use strict';

var ContactsCtrl = require('../../../../src/js/controller/app/contacts'),
    Dialog = require('../../../../src/js/util/dialog');

describe('Contacts Controller unit test', function() {
    var scope, contactsCtrl, dialogStub;

    beforeEach(function() {
        dialogStub = sinon.createStubInstance(Dialog);

        angular.module('contactstest', ['woServices']);
        angular.mock.module('contactstest');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            contactsCtrl = $controller(ContactsCtrl, {
                $scope: scope,
                $q: window.qMock,
                dialog: dialogStub
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.state.contacts.toggle).to.exist;
        });
    });

    describe('listKeys', function() {

        it('should work', function(done) {
            scope.listKeys().then(function() {
                //expect(scope.keys.length).to.equal(1);
                //expect(scope.keys[0]._id).to.equal('12345');
                //expect(scope.keys[0].fingerprint).to.equal('asdf');
                //expect(scope.keys[0].fullUserId).to.equal('Firstname Lastname <first.last@example.com>');
                done();
            });
        });
    });

    describe('getFingerprint', function() {
        it('should work', function() {
            var key = {
                fingerprint: 'YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY'
            };

            scope.getFingerprint(key);

            expect(scope.fingerprint).to.equal('YYYY YYYY YYYY YYYY YYYY ... YYYY YYYY YYYY YYYY YYYY');
        });
    });

    describe('removeKey', function() {
        it('should work', function(done) {
            var key = {
                _id: '12345'
            };

            scope.listKeys = function() {};

            scope.removeKey(key).then(function() {
                done();
            });
        });
    });
});
