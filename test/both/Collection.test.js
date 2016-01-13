import {Document} from '../../lib/Document';
import Collection from '../../lib/Collection';
import StorageManager from '../../lib/StorageManager';
import CursorObservable from '../../lib/CursorObservable';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('Collection', () => {

  describe('#constructor', function () {
    it('should accept second argument with options', function () {
      class NewStorageManager {}
      function new_id_generator() {}
      class NewCursor {}

      const db = new Collection('test', {
        storageManager: NewStorageManager,
        idGenerator: new_id_generator,
        cursorClass: NewCursor,
      });

      db.storageManager.should.be.an.instanceof(NewStorageManager);
      db.idGenerator.should.be.equal(new_id_generator);
      db.cursorClass.should.be.equal(NewCursor);
    });
  });

  describe('#create', function () {
    it('should return the same object if it is an Object', function () {
      const db = new Collection('test');
      const raw = {a: 2, b: 3};
      const doc = db.create(raw);
      doc.should.be.equal(raw);
    });

    it('should make an object from string', function () {
      const db = new Collection('test');
      const doc = db.create('{"a": 2, "b": 3}');
      doc.a.should.be.equal(2);
      doc.b.should.be.equal(3);
    });
  });

  describe('#defaultStorageManager', function () {
    it('should return default in-memory StorageManager', function () {
      Collection.defaultStorageManager().should.be.equal(StorageManager);
    });
    it('should set default storage manager', function () {
      const oldStorage = Collection.defaultStorageManager();
      class NewStorageManager {}
      Collection.defaultStorageManager(NewStorageManager);
      Collection.defaultStorageManager().should.be.equal(NewStorageManager);
      Collection.defaultStorageManager(oldStorage);
    });
  });

  describe('#defaultIdGenerator', function () {
    it('should set default id generator', function () {
      const oldGenerator = Collection.defaultIdGenerator();
      function new_id_generator() {}
      Collection.defaultIdGenerator(new_id_generator);
      Collection.defaultIdGenerator().should.be.equal(new_id_generator);
      Collection.defaultIdGenerator(oldGenerator);
    });
  });

  describe('#defaultCursorClass', function () {
    it('should return default CursorObservable', function () {
      Collection.defaultCursorClass().should.be.equal(CursorObservable);
    });
    it('should set default Cursor class', function () {
      const oldCursor = Collection.defaultCursorClass();
      class NewCursor {}
      Collection.defaultCursorClass(NewCursor);
      Collection.defaultCursorClass().should.be.equal(NewCursor);
      Collection.defaultCursorClass(oldCursor);
    });
  });

  describe('#modelName', function () {
    it('should return name of the model', function () {
      const db = new Collection('test');
      db.modelName.should.be.equal('test');
    });
  });


  describe('#indexes', function () {
    it('should return indexes object', function () {
      const db = new Collection('test');
      db.indexes.should.have.ownProperty('_id');
    });
  });


  describe('#storage', function () {
    it('should return storage', function () {
      const db = new Collection('test');
      db.storage.should.not.equals(undefined);
    });
  });


  describe('#create', function () {
    it('should create new document by raw', function () {
      const db = new Collection('test');
      const doc = db.create({a: 1, b: 2, c: {d: {e: 3}}});
      doc.c.d.e.should.equals(3);
      doc.a.should.equals(1);
      doc.b.should.equals(2);
    });
  });


  describe('#ensureIndex', function () {
    it('should ensure index', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.ensureIndex({fieldName: 'a'});
      }).then(() => {
        expect(db.indexes.a).to.be.an('object');
        //db.indexes.a.getAll().should.to.have.length(3);
      });
    });

    it('should rise an exception if key is null/undefined', function () {
      const db = new Collection('test');
      (() => db.ensureIndex(null)).should.throw(Error);
      (() => db.ensureIndex('a')).should.throw(Error);
      (() => db.ensureIndex({})).should.throw(Error);
      (() => db.ensureIndex({fieldName: null})).should.throw(Error);
    });
  });


  describe('#insert', function () {
    it('should insert document and return new document id', function () {
      const db = new Collection('test');
      return db.insert({test: 'passed'}).then((docId) => {
        return db.findOne({_id: docId});
      }).then((doc) => {
        doc.test.should.to.be.equals('passed');
      });
    });

    it('should emit events', function (done) {
      const db = new Collection('test');

      var syncEmited = false;
      db.on('insert', () => {
        syncEmited.should.be.equals(true);
        done();
      })
      db.on('sync:insert', (doc, randomId) => {
        doc.should.to.have.ownProperty('test');
        doc.should.to.have.ownProperty('_id');
        syncEmited = true;
      })
      db.insert({test: 'passed'});
    });

    it('should be quiet for syncing', function (done) {
      const db = new Collection('test');
      db.on('insert', () => {
        done();
      })
      db.on('sync:insert', (doc, randomId) => {
        throw new Error();
      })
      db.insert({test: 'passed'}, {quiet: true});
    });

    it('should index a doucmnet', function () {
      const db = new Collection('test');
      return db.ensureIndex({fieldName: 'test'}).then(() => {
        return db.insert({test: 'passed'});
      }).then((docId) => {
        //db.indexes.test.getAll().should.have.length(1);
        //db.indexes.test.getAll()[0].should.be.equals(docId);
      });
    });

    it('should be quiet if options.quiet passed', function () {
      const db = new Collection('test');
      const cb = sinon.spy();
      db.on('sync:insert', cb);
      db.insert({a: 1}, {quiet: true});
      cb.should.have.callCount(0);
    });
  });


  describe('#insertAll', function () {
    it('should insert all documents from given array', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then((docIds) => {
        docIds.should.have.length(3);
        return db.find({_id: {$in: docIds}}).sort({a: 1}).exec();
      }).then((docs) => {
        docs.should.have.length(3);
        docs[0].a.should.be.equals(1);
        docs[1].a.should.be.equals(2);
        docs[2].a.should.be.equals(3);
      });
    });
  });


  describe('#remove', function () {
    it('should remove multiple documents by query', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then((docIds) => {
        return db.remove({a: {$in: [1, 3]}}, {multi: true});
      }).then((docs) => {
        expect(docs).to.be.an('array');
        docs.should.have.length(2);
        return db.ids();
      }).then((ids) => {
        expect(ids).to.be.an('array');
        ids.should.have.length(1);
        return db.find({_id: {$in: ids}}).exec();
      }).then((docs) => {
        expect(docs).to.be.an('array');
        docs.should.have.length(1);
        docs[0].a.should.to.be.equals(2);
      });
    });

    it('should throw an error if remove multiple without option multi', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then((docIds) => {
        return db.remove({a: {$in: [1, 3]}}).should.eventually.rejectedWith(Error);
      })
    });

    it('should emit events "remove" and "sync:remove"', function (done) {
      const db = new Collection('test');

      var removeEvents = 0;
      var syncEmited = false;
      db.on('remove', () => {
        syncEmited.should.be.equals(true);
        removeEvents += 1;
        if (removeEvents === 2) {
          done();
        }
      })
      db.on('sync:remove', (query, options) => {
        query.should.to.be.deep.equals({a: {$in: [1, 3]}});
        options.should.to.be.deep.equals({multi: true});
        syncEmited = true;
      })
      db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then((docIds) => {
        db.remove({a: {$in: [1, 3]}}, {multi: true});
      });
    });

    it('should deindex a doucmnet', function () {
      const db = new Collection('test');
      return db.ensureIndex({fieldName: 'a'}).then(() => {
        return db.insertAll([{a: 1}, {a: 2}, {a: 3}]);
      }).then(() => {
        return db.remove({a: {$in: [1, 3]}}, {multi: true});
      }).then((removedDocs) => {
        //db.indexes.a.getAll().should.have.length(1);
        expect(removedDocs).to.be.an('array');
        removedDocs.should.have.length(2);
      });
    });

    it('should be quiet if options.quiet passed', function () {
      const db = new Collection('test');
      const cb = sinon.spy();
      db.on('sync:remove', cb);
      db.remove({}, {quiet: true, multi: true});
      cb.should.have.callCount(0);
    });
  });


  describe('#update', function () {
    it('should update a document', function () {
      const db = new Collection('test');
      return db.ensureIndex({fieldName: 'a'}).then(() => {
        return db.insertAll([{a: 1}, {a: 2}, {a: 3}]);
      }).then(() => {
        return db.update({a: 1}, {$set: {a: 4}});
      }).then((result) => {
        result.modified.should.be.equals(1);
        result.updated[0].a.should.be.equals(4);
        return db.find({a: 4});
      }).then((result) => {
        expect(result).to.be.an('array');
        result.should.have.length(1);
        result[0].a.should.be.equals(4);
      });
    });


    it('should emit events and can be quiet', function () {
      const db = new Collection('test');
      const cb = sinon.spy();
      db.on('sync:update', cb);
      db.update({}, {$set: {a: 1}}, {});
      cb.should.have.callCount(1);
    });

    it('should be quiet if options.quiet passed', function () {
      const db = new Collection('test');
      const cb = sinon.spy();
      db.on('sync:update', cb);
      db.update({}, {$set: {a: 1}}, {quiet: true});
      cb.should.have.callCount(0);
    });

    it('should update index of a doucmnet', function () {
      // TODO
    });
  });

  describe('#getIndexIds', function () {
    it('should return all indexed document ids', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        db.getIndexIds(); //.should.have.length(3);
      })
    });
  });

  describe('#findOne', function () {
    it('should find only one document', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.findOne({a: 2}, {}, {});
      }).then((doc) => {
        expect(doc).to.be.an('object');
        doc.a.should.be.equals(2);
      });
    });

    it('should return undefined if document not found', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.findOne({a: 5});
      }).then((doc) => {
        expect(doc).to.be.an('undefined');
      });
    });
  });


  describe('#count', function () {
    it('should return count of documents by query', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.count({a: {$in: [1, 3]}}, {});
      }).then((num) => {
        num.should.be.equals(2);
      });
    });

    it('should return zero if no documents found', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.count({a: 5});
      }).then((num) => {
        num.should.be.equals(0);
      });
    });
  });


  describe('#ids', function () {
    it('should return list of ids by given query', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1}),
        db.insert({a: 2}),
        db.insert({a: 3}),
      ]).then((docs) => {
        return db.ids({a: {$in: [1, 3]}}, {});
      }).then((ids) => {
        expect(ids).to.be.an('array');
        ids.should.have.length(2);
      });
    });
  });
});