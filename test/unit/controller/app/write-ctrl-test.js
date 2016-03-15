'use strict';

var WriteCtrl = require('../../../../src/js/controller/app/write'),
    Email = require('../../../../src/js/email/email'),
    Outbox = require('../../../../src/js/email/outbox'),
    Auth = require('../../../../src/js/service/auth'),
    Status = require('../../../../src/js/util/status'),
    Dialog = require('../../../../src/js/util/dialog');

describe('Write controller unit test', function() {
    var ctrl, scope,
        authMock, dialogMock, emailMock, outboxMock, statusMock,
        emailAddress, realname;

    beforeEach(function() {

        authMock = sinon.createStubInstance(Auth);
        dialogMock = sinon.createStubInstance(Dialog);
        outboxMock = sinon.createStubInstance(Outbox);
        emailMock = sinon.createStubInstance(Email);
        statusMock = sinon.createStubInstance(Status);

        emailAddress = 'fred@foo.com';
        realname = 'Fred Foo';
        authMock.emailAddress = emailAddress;
        authMock.realname = realname;

        angular.module('writetest', ['woEmail', 'woServices', 'woUtil']);
        angular.mock.module('writetest');
        angular.mock.inject(function($rootScope, $controller) {
            scope = $rootScope.$new();
            scope.state = {};
            ctrl = $controller(WriteCtrl, {
                $scope: scope,
                $q: window.qMock,
                auth: authMock,
                email: emailMock,
                outbox: outboxMock,
                dialog: dialogMock,
                status: statusMock
            });
        });
    });

    afterEach(function() {});

    describe('scope variables', function() {
        it('should be set correctly', function() {
            expect(scope.state.writer).to.exist;
            expect(scope.state.lightbox).to.be.undefined;
            expect(scope.state.writer.write).to.exist;
            expect(scope.state.writer.close).to.exist;
            expect(scope.verify).to.exist;
            expect(scope.checkSendStatus).to.exist;
            expect(scope.sendToOutbox).to.exist;
            expect(scope.tagStyle).to.exist;
            expect(scope.lookupAddressBook).to.exist;
        });
    });

    describe('close', function() {
        it('should close the writer', function() {
            scope.state.lightbox = 'write';

            scope.state.writer.close();

            expect(scope.state.lightbox).to.be.undefined;
        });
    });

    describe('write', function() {
        it('should prepare write view', function() {
            var verifyMock = sinon.stub(scope, 'verify');

            scope.state.writer.write();

            expect(scope.writerTitle).to.equal('New email');
            expect(scope.to).to.deep.equal([]);
            expect(scope.subject).to.equal('');
            expect(scope.body).to.equal('');
            expect(verifyMock.calledOnce).to.be.true;

            scope.verify.restore();
        });

        it('should prefill write view for response', function() {
            var verifyMock = sinon.stub(scope, 'verify'),
                address = 'pity@dafool',
                subject = 'Ermahgerd!',
                body = 'so much body!',
                re = {
                    id: 'abc',
                    from: [{
                        address: address
                    }],
                    subject: subject,
                    sentDate: new Date(),
                    body: body,
                    references: ['ghi', 'def']
                };

            scope.state.writer.write(re);

            expect(scope.writerTitle).to.equal('Reply');
            expect(scope.to).to.deep.equal([{
                address: address,
            }]);
            expect(scope.subject).to.equal('Re: ' + subject);
            expect(scope.body).to.contain(body);
            expect(scope.references).to.deep.equal(['ghi', 'def', 'abc']);
            expect(verifyMock.called).to.be.true;

            scope.verify.restore();
        });

        it('should prefill write view for forward', function() {
            var verifyMock = sinon.stub(scope, 'verify'),
                address = 'pity@dafool',
                subject = 'Ermahgerd!',
                body = 'so much body!',
                re = {
                    from: [{
                        address: address
                    }],
                    to: [{
                        address: address
                    }],
                    subject: subject,
                    sentDate: new Date(),
                    body: body,
                    attachments: [{}]
                };

            scope.state.writer.write(re, null, true);

            expect(scope.writerTitle).to.equal('Forward');
            expect(scope.to).to.deep.equal([]);
            expect(scope.subject).to.equal('Fwd: ' + subject);
            expect(scope.body).to.contain(body);
            expect(verifyMock.called).to.be.true;
            expect(scope.attachments).to.not.equal(re.attachments); // not the same reference
            expect(scope.attachments).to.deep.equal(re.attachments); // but the same content

            scope.verify.restore();
        });

    });

    describe('verify', function() {
        var checkSendStatusMock;

        beforeEach(function() {
            checkSendStatusMock = sinon.stub(scope, 'checkSendStatus');
        });

        afterEach(function() {
            scope.checkSendStatus.restore();
        });

        it('should do nothing if recipient is not provided', function() {
            scope.verify(undefined);
        });

        it('should not work for invalid email addresses', function() {
            var recipient = {
                address: ''
            };

            scope.verify(recipient);
            expect(scope.checkSendStatus.callCount).to.equal(2);
        });
    });

    describe('checkSendStatus', function() {
        beforeEach(function() {
            scope.state.writer.write();
        });

        afterEach(function() {});

        it('should not be able to send with no recipients', function() {
            scope.checkSendStatus();

            expect(scope.okToSend).to.be.false;
            expect(scope.sendBtnText).to.be.undefined;
        });

        it('should be able to send plaintext', function() {
            scope.to = [{
                address: 'asdf@asdf.de'
            }];
            scope.checkSendStatus();

            expect(scope.okToSend).to.be.true;
            expect(scope.sendBtnText).to.equal('Send');
        });

        it('should send plaintext if one receiver is not secure', function() {
            scope.to = [{
                address: 'asdf@asdf.de',
                secure: true
            }, {
                address: 'asdf@asdfg.de'
            }];
            scope.checkSendStatus();

            expect(scope.okToSend).to.be.true;
            expect(scope.sendBtnText).to.equal('Send');
        });

        it('should be able to send to multiple recipients', function() {
            scope.to = [{
                address: 'asdf@asdf.de',
                secure: true
            }, {
                address: 'asdf@asdfg.de',
                secure: true
            }];
            scope.checkSendStatus();

            expect(scope.okToSend).to.be.true;
            expect(scope.sendBtnText).to.equal('Send');
        });
    });

    describe('send to outbox', function() {
        it('should work', function(done) {
            scope.to = [{
                address: 'pity@dafool'
            }];
            scope.cc = [];
            scope.bcc = [];
            scope.subject = 'Ermahgerd!';
            scope.body = 'wow. much body! very text!';
            scope.attachments = [];
            scope.state.nav = {
                currentFolder: 'currentFolder'
            };

            scope.replyTo = {};

            outboxMock.put.withArgs(sinon.match(function(mail) {
                expect(mail.from).to.deep.equal([{
                    address: emailAddress,
                    name: realname
                }]);

                expect(mail.to).to.deep.equal(scope.to);
                expect(mail.cc).to.deep.equal(scope.cc);
                expect(mail.bcc).to.deep.equal(scope.bcc);
                expect(mail.body).to.contain(scope.body);
                expect(mail.subject).to.equal(scope.subject);
                expect(mail.attachments).to.be.empty;
                expect(mail.sentDate).to.exist;

                return true;
            })).returns(resolves());
            emailMock.setFlags.returns(resolves());

            scope.sendToOutbox().then(function() {
                expect(statusMock.setReading.withArgs(false).calledOnce).to.be.true;
                expect(outboxMock.put.calledOnce).to.be.true;
                expect(emailMock.setFlags.calledOnce).to.be.true;
                expect(scope.state.lightbox).to.be.undefined;
                expect(scope.replyTo.answered).to.be.true;
                done();
            });
        });
    });

    describe('lookupAddressBook', function() {
        it('should work', function() {
            //mock.listLocalPublicKeys.returns(resolves([{
            //    name: 'Bob'
            //    userId: 'test@asdf.com',
            //    publicKey: 'KEY'
            //}]));

            var result = scope.lookupAddressBook('test');

            return result.then(function(response) {
                //expect(response).to.deep.equal([{
                //    address: 'test@asdf.com',
                //    displayId: 'Bob - test@asdf.com'
                //}]);
                expect(response).to.be.empty;
            });
        });

        it('should work with cache', function(done) {
            scope.addressBookCache = [{
                address: 'test@asdf.com',
                displayId: 'Bob - test@asdf.com'
            }, {
                address: 'tes@asdf.com',
                displayId: 'Bob - tes@asdf.com'
            }];

            var result = scope.lookupAddressBook('test');

            result.then(function(response) {
                expect(response).to.deep.equal([scope.addressBookCache[0]]);
                done();
            });
        });
    });

});
