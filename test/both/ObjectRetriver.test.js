import Collection from '../../lib/Collection';
import DocumentRetriver from '../../lib/DocumentRetriver';
import async from 'async';
import chai from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('DocumentRetriver', () => {
  it('should be created', () => {
    const db = new Collection('test')
    const retr = new DocumentRetriver(db);
  });

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