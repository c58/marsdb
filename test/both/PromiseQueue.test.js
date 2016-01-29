import PromiseQueue from '../../lib/PromiseQueue';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('PromiseQueue', () => {
  describe('#add', function () {
    it('should rise an exception if queue is full', function () {
      const queue = new PromiseQueue(1, 1);
      return Promise.all([
        queue.add(() => {}),
        queue.add(() => {}).should.be.eventually.rejected,
      ]);
    });

    it('should start task execution with give concurrency', function () {
      const cb1 = sinon.spy();
      const cb2 = sinon.spy();
      const cb3 = sinon.spy();
      const queue = new PromiseQueue(2);
      const ops = [
        queue.add(cb1),
        queue.add(cb2),
        queue.add(cb3),
      ];
      queue.length.should.be.equals(3);
      cb1.should.have.callCount(0);
      cb2.should.have.callCount(0);
      cb3.should.have.callCount(0);
      return Promise.all(ops).then(() => {
        cb1.should.have.callCount(1);
        cb2.should.have.callCount(1);
        cb3.should.have.callCount(1);
        queue.length.should.be.equals(0);
      });
    });

    it('should reject on error and process next item', function () {
      const cb1 = sinon.spy();
      const cb2 = sinon.spy();
      const queue = new PromiseQueue(1);
      return Promise.all([
        queue.add(() => {
          throw new Error();
        }).should.be.eventually.rejected,
        queue.add(() => {
          return new Promise((resolve, reject) => {
            throw new Error();
          })
        }).should.be.eventually.rejected,
        queue.add(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error());
            }, 10);
          })
        }).should.be.eventually.rejected,
        queue.add(() => {}).should.be.eventually.fulfilled,
      ]);
    });

    it('should start execution only after task resolved', function () {
      const cb1 = sinon.spy();
      const cb2 = sinon.spy();
      const queue = new PromiseQueue(2);
      return Promise.all([
        queue.add(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              cb1();
              resolve();
            }, 10);
          })
        }),
        queue.add(() => {
          cb1.should.have.callCount(0);
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              cb2();
              resolve();
            }, 20);
          })
        }),
        queue.add(() => {
          cb1.should.have.callCount(1);
          cb2.should.have.callCount(0);
        }),
      ]);
    });
  });
});