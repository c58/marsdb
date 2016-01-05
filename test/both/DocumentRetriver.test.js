import Collection from '../../lib/Collection';
import DocumentRetriver from '../../lib/DocumentRetriver';
import chai from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('DocumentRetriver', () => {
  describe('#constructor', function () {
    it('should be created', () => {
      const db = new Collection('test')
      const retr = new DocumentRetriver(db);
    });
  });

  describe('#retriveForQeury', function () {
    it('should retrive one by id if given an id', function () {

    });

    it('should retrive one by id if given only object with id', function () {

    });

    it('should retrive multiple by given list of ids', function () {

    });

    it('should retrive all if no ids provided', function () {

    });
  });

  describe('#retriveIds', function () {
    it('should retrive only documents by id', function () {

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