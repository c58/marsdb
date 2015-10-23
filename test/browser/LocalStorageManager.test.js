import Collection from '../../lib/Collection';
import EJSON from '../../lib/EJSON';
import StorageManager from '../../lib/storages/LocalStorageManager';
import async from 'async';
import chai, {expect, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('LocalStorageManager', () => {

  let db;
  beforeEach(function () {
    db = new Collection('test', {storageManager: StorageManager});
    localStorage.clear();
    return db.storage.destroy();
  });

  describe('#destroy', function () {
    it('should destroy a whole collection everywhere', function () {
      return Promise.all([
        db.insert({a: 1, b: 2, _id: 1}),
        db.insert({a: 2, b: 3, _id: 2}),
        db.insert({a: 3, b: 4, _id: 3}),
        db.insert({a: 4, b: 5, _id: 4}),
        db.insert({a: 5, b: 6, _id: 5}),
        db.insert({a: 6, b: 7, _id: 6}),
      ]).then((ids) => {
        localStorage.length.should.be.equal(6);
        return Promise.all([
          db.storage.get(2).should.be.eventually.deep.equal({a: 2, b: 3, _id: 2}),
          db.storage.get(1000).should.be.eventually.deep.equal(undefined),
        ]);
      }).then(() => {
        return db.storage.destroy();
      }).then(() => {
        localStorage.length.should.be.equal(0);
        return Promise.all([
          db.storage.get(2).should.not.be.eventually.deep.equal({a: 2, b: 3, _id: 2}),
          db.storage.get(2).should.be.eventually.deep.equal(undefined),
        ]);
      });
    });
  });

  describe('#persist', function () {
    it('should persist on insert', function () {
      return db.insert({a: 1, b: 2, _id: 1}).then(() => {
        localStorage.length.should.be.equal(1);
        localStorage.getItem(db.storage._makeStorageKey(1))
          .should.be.equal(EJSON.stringify({a: 1, b: 2, _id: 1}));
      });
    });

    it('should persist on insert multiple docs at once', function () {
      return db.insertAll([
        {a: 1, b: 2, _id: 1},
        {a: 2, b: 2, _id: 2},
        {a: 3, b: 2, _id: 3},
      ]).then(() => {
        localStorage.length.should.be.equal(3);
        localStorage.getItem(db.storage._makeStorageKey(1))
          .should.be.equal(EJSON.stringify({a: 1, b: 2, _id: 1}));
        localStorage.getItem(db.storage._makeStorageKey(2))
          .should.be.equal(EJSON.stringify({a: 2, b: 2, _id: 2}));
        localStorage.getItem(db.storage._makeStorageKey(3))
          .should.be.equal(EJSON.stringify({a: 3, b: 2, _id: 3}));
      });
    });

    it('should persist on update', function () {
      return db.insert({a: 1, b: 2, _id: 1}).then(() => {
        return db.update(1, {$set: {a: 2}});
      }).then(() => {
        localStorage.length.should.be.equal(1);
        localStorage.getItem(db.storage._makeStorageKey(1))
          .should.be.equal(EJSON.stringify({a: 2, b: 2, _id: 1}));
      });
    });
  });

  describe('#delete', function () {
    it('should delete from storage on remove', function () {
      return db.insert({a: 1, b: 2, _id: 1}).then(() => {
        localStorage.length.should.be.equal(1);
        localStorage.getItem(db.storage._makeStorageKey(1))
          .should.be.equal(EJSON.stringify({a: 1, b: 2, _id: 1}));
      }).then(() => {
        return db.remove(1);
      }).then(() => {
        localStorage.length.should.be.equal(0);
        return expect(db.findOne(1)).to.be.eventually.equal(undefined);
      });
    });

    it('should have no errors on deleting non-existing key', function () {
      return db.insert({a: 1, b: 2, _id: 1}).then(() => {
        localStorage.length.should.be.equal(1);
        localStorage.getItem(db.storage._makeStorageKey(1))
          .should.be.equal(EJSON.stringify({a: 1, b: 2, _id: 1}));
      }).then(() => {
        return db.remove(1);
      }).then(() => {
        localStorage.length.should.be.equal(0);
        return db.storage.delete(1);
      });
    });
  });

  describe('#reload', function () {
    it('should reload and finds wait until reload done', function () {
      localStorage.length.should.be.equal(0);
      localStorage.setItem(db.storage._makeStorageKey(1), EJSON.stringify({a: 1, _id: 1}));
      localStorage.setItem(db.storage._makeStorageKey(2), EJSON.stringify({a: 2, _id: 2}));
      localStorage.setItem(db.storage._makeStorageKey(3), EJSON.stringify({a: 3, _id: 3}));
      localStorage.setItem('mrs.test2.4', EJSON.stringify({a: 4, _id: 4}));
      localStorage.length.should.be.equal(4);

      return expect(db.findOne(1)).to.be.eventually.equal(undefined).then(() => {
        db.storage.reload();
        return Promise.all([
          expect(db.findOne(1)).to.be.eventually.deep.equal({a: 1, _id: 1}),
          expect(db.findOne(2)).to.be.eventually.deep.equal({a: 2, _id: 2}),
          expect(db.findOne(3)).to.be.eventually.deep.equal({a: 3, _id: 3}),
          expect(db.findOne(4)).to.be.eventually.deep.equal(undefined),
        ]);
      })
    });

    it('should update wait until reload', function () {
      localStorage.length.should.be.equal(0);
      localStorage.setItem(db.storage._makeStorageKey(1), EJSON.stringify({a: 1, _id: 1}));
      localStorage.setItem(db.storage._makeStorageKey(2), EJSON.stringify({a: 2, _id: 2}));
      localStorage.setItem(db.storage._makeStorageKey(3), EJSON.stringify({a: 3, _id: 3}));
      localStorage.setItem('mrs.test2.4', EJSON.stringify({a: 4, _id: 4}));
      localStorage.length.should.be.equal(4);

      return expect(db.findOne(1)).to.be.eventually.equal(undefined).then(() => {
        db.storage.reload();
        return db.update(1, {$set: {a: 5}});
      }).then(res => {
        res.modified.should.be.equal(1);
        res.updated.length.should.be.equal(1);
        res.updated[0].should.be.deep.equal({a: 5, _id: 1});
      });
    });
  });
});