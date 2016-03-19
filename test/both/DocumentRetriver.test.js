import Collection from '../../lib/Collection';
import DocumentRetriver from '../../lib/DocumentRetriver';
import chai from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();



describe('DocumentRetriver', () => {
  let db, retr;
  beforeEach(function () {
    db = new Collection('test')
    retr = new DocumentRetriver(db);
    return Promise.all([
      db.insert({a: 1, _id: '1'}),
      db.insert({a: 2, _id: '2'}),
      db.insert({a: 3, _id: '3'}),
    ]);
  });

  describe('#retriveForQeury', function () {
    it('should retrive one by id if given an id', function () {
      return Promise.all([
        retr.retriveForQeury('1').should.eventually.be.deep.equal([{a: 1, _id: '1'}]),
      ]);
    });

    it('should retrive one by id if given only object with id', function () {
      return Promise.all([
        retr.retriveForQeury({_id: '1'}).should.eventually.be.deep.equal([{a: 1, _id: '1'}]),
      ]);
    });

    it('should retrive multiple by given list of ids', function () {
      return Promise.all([
        retr.retriveForQeury({_id: {$in: ['1', '2']}}).should.eventually
          .be.deep.equal([{a: 1, _id: '1'}, {a: 2, _id: '2'}]),
      ]);
    });

    it('should retrive all if no ids provided', function () {
      return Promise.all([
        retr.retriveForQeury({}).should.eventually.have.length(3),
        retr.retriveForQeury().should.eventually.have.length(3),
        retr.retriveForQeury(null).should.eventually.have.length(3),
        retr.retriveForQeury(undefined).should.eventually.have.length(3),
        retr.retriveForQeury({a: {$gte: 1}}).should.eventually.have.length(3),
        retr.retriveForQeury({a: {$gte: 2}}).should.eventually.have.length(3),
        retr.retriveForQeury({a: {$gte: 3}}).should.eventually.have.length(3),
        retr.retriveForQeury({_id: null}).should.eventually.have.length(3),
        retr.retriveForQeury({_id: undefined}).should.eventually.have.length(3),
        retr.retriveForQeury({_id: {$in: []}}).should.eventually.have.length(3),
      ]);
    });

    it('should use queryFilter for filtering documents', function () {
      retr.retriveForQeury({}, (d) => d._id === '1').should.eventually.have.length(1);
    });
  });

  describe('#retriveIds', function () {
    it('should retrive only documents by id', function () {
      return Promise.all([
        retr.retriveIds(undefined, []).should.eventually.be.deep.equal([]),
        retr.retriveIds(undefined, ['1']).should.eventually.be.deep.equal([{a: 1, _id: '1'}]),
        retr.retriveIds(undefined, ['2', '1']).should.eventually
          .be.deep.equal([{a: 2, _id: '2'}, {a: 1, _id: '1'}]),
      ]);
    });
  });

  describe('#retriveAll', function () {
    it('should retrive all', () => {
      const db = new Collection('test');
      return Promise.all([
        db.storage.persist('1', {_id: '1', a: 1}),
        db.storage.persist('2', {_id: '2', a: 2}),
        db.storage.persist('3', {_id: '3', a: 3}),
        db.storage.persist('4', {_id: '4', a: 4}),
        db.storage.persist('5', {_id: '5', a: 5}),
        db.storage.persist('6', {_id: '6', a: 6})
      ]).then(() => {
        const retr = new DocumentRetriver(db);
        return retr.retriveAll().should.eventually.deep.equal([
          {_id: '1', a: 1},
          {_id: '2', a: 2},
          {_id: '3', a: 3},
          {_id: '4', a: 4},
          {_id: '5', a: 5},
          {_id: '6', a: 6},
        ]);
      });
    });

    it('should filter documents by queryFilter', function () {
      const db = new Collection('test');
      return Promise.all([
        db.storage.persist('1', {_id: '1', a: 1}),
        db.storage.persist('2', {_id: '2', a: 2}),
        db.storage.persist('3', {_id: '3', a: 3}),
        db.storage.persist('4', {_id: '4', a: 4}),
        db.storage.persist('5', {_id: '5', a: 5}),
        db.storage.persist('6', {_id: '6', a: 6})
      ]).then(() => {
        const retr = new DocumentRetriver(db);
        const qf = (d) => d._id === '1' || d._id === '2';
        return retr.retriveAll(qf).should.eventually.deep.equal([
          {_id: '1', a: 1},
          {_id: '2', a: 2},
        ]);
      });
    });

    it('should limit the result of passed docs', function () {
      const db = new Collection('test');
      return Promise.all([
        db.storage.persist('1', {_id: '1', a: 1}),
        db.storage.persist('2', {_id: '2', a: 2}),
        db.storage.persist('3', {_id: '3', a: 3}),
        db.storage.persist('4', {_id: '4', a: 4}),
        db.storage.persist('5', {_id: '5', a: 5}),
        db.storage.persist('6', {_id: '6', a: 6})
      ]).then(() => {
        const retr = new DocumentRetriver(db);
        const qf = (d) => d._id === '1' || d._id === '2';
        return retr.retriveAll(qf, {limit: 1}).should.eventually.deep.equal([
          {_id: '1', a: 1},
        ]);
      });
    });
  });

  describe('#retriveOne', function () {
    it('should retrive one', () => {
      const db = new Collection('test')
      return Promise.all([
        db.storage.persist('1', {_id: '1', a: 1}),
        db.storage.persist('2', {_id: '2', a: 2}),
        db.storage.persist('3', {_id: '3', a: 3}),
        db.storage.persist('4', {_id: '4', a: 4}),
        db.storage.persist('5', {_id: '5', a: 5}),
        db.storage.persist('6', {_id: '6', a: 6})
      ]).then(() => {
        const retr = new DocumentRetriver(db);
        return retr.retriveOne('1').should.eventually.deep.equal({_id: '1', a: 1});
      });
    });
  });

});
