import {Document} from '../../lib/Document';
import Collection, { _resetStartup } from '../../lib/Collection';
import StorageManager from '../../lib/StorageManager';
import CursorObservable from '../../lib/CursorObservable';
import CollectionDelegate from '../../lib/CollectionDelegate';
import chai, {expect} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();


describe('Collection', () => {

  const _defaultIdGenerator = Collection.defaultIdGenerator();
  const _defaultDelegate = Collection.defaultDelegate();
  const _defaultStorageManager = Collection.defaultStorageManager();
  const _defaultIndexManager = Collection.defaultIndexManager();
  const _defaultCursor = Collection.defaultCursor();
  beforeEach(function () {
    _resetStartup(10);
    Collection.defaultCursor(_defaultCursor);
    Collection.defaultDelegate(_defaultDelegate);
    Collection.defaultStorageManager(_defaultStorageManager);
    Collection.defaultIndexManager(_defaultIndexManager);
    Collection.defaultIdGenerator(_defaultIdGenerator);
  });

  describe('#constructor', function () {
    it('should override defaults', function () {
      class NewStorageManager {}
      function new_id_generator() {}
      class NewIndexManager {}
      class NewDelegate {}

      const db = new Collection('test', {
        storageManager: NewStorageManager,
        idGenerator: new_id_generator,
        indexManager: NewIndexManager,
        delegate: NewDelegate,
      });

      db._lazyInitCollection();
      db.storageManager.should.be.an.instanceof(NewStorageManager);
      db.idGenerator.should.be.equal(new_id_generator);
      db.indexManager.should.be.an.instanceof(NewIndexManager);
      db.delegate.should.be.an.instanceof(NewDelegate);
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

  describe('#defaultCursor', function () {
    it('should set default cursor', function () {
      class NewCursor {}
      Collection.defaultCursor(NewCursor);
      Collection.defaultCursor().should.be.equal(NewCursor);
    });
    it('should initialize lazy', function () {
      const defColl = new Collection('test');
      expect(defColl.cursorClass).to.be.undefined;
      class NewCursor {}
      Collection.defaultCursor(NewCursor);
      defColl._lazyInitCollection();
      defColl.cursorClass.should.be.equal(NewCursor);
    });
  });

  describe('#defaultStorageManager', function () {
    it('should set default storage manager', function () {
      class NewStorageManager {}
      Collection.defaultStorageManager(NewStorageManager);
      Collection.defaultStorageManager().should.be.equal(NewStorageManager);
    });
    it('should upgrade all collections uses defaults', function () {
      const defColl = new Collection('test');
      expect(defColl.storageManager).to.be.undefined;
      class NewStorageManager {}
      Collection.defaultStorageManager(NewStorageManager);
      defColl.storage.should.be.instanceof(NewStorageManager);
    });
  });

  describe('#defaultIdGenerator', function () {
    it('should set default id generator', function () {
      function new_id_generator() {}
      Collection.defaultIdGenerator(new_id_generator);
      Collection.defaultIdGenerator().should.be.equal(new_id_generator);
    });
    it('should upgrade all collections uses defaults', function () {
      const defColl = new Collection('test');
      function new_id_generator() {}
      Collection.defaultIdGenerator(new_id_generator);
      defColl._lazyInitCollection();
      defColl.idGenerator.should.be.equal(new_id_generator);
    });
  });

  describe('#defaultDelegate', function () {
    it('should set default Delegate class', function () {
      class NewDelegate {}
      Collection.defaultDelegate(NewDelegate);
      Collection.defaultDelegate().should.be.equal(NewDelegate);
    });
    it('should upgrade all collections uses defaults', function () {
      const defColl = new Collection('test');
      class NewDelegate {}
      Collection.defaultDelegate(NewDelegate);
      defColl._lazyInitCollection();
      defColl.delegate.should.be.instanceof(NewDelegate);
    });
  });

  describe('#defaultIndexManager', function () {
    it('should set default index manager class', function () {
      class NewIndexManager {}
      Collection.defaultIndexManager(NewIndexManager);
      Collection.defaultIndexManager().should.be.equal(NewIndexManager);
    });
    it('should upgrade all collections uses defaults', function () {
      const defColl = new Collection('test');
      class NewIndexManager {}
      Collection.defaultIndexManager(NewIndexManager);
      defColl._lazyInitCollection();
      defColl.indexManager.should.be.instanceof(NewIndexManager);
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

    it('should remove only first document if multi not specified', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then((docIds) => {
        return db.remove({a: {$in: [3, 1]}});
      }).then((res) => {
        res.should.have.length(1);
        return db.find().then((docs) => {
          docs.should.have.length(2);
          docs[0].a.should.not.be.equal(res[0].a);
          docs[1].a.should.not.be.equal(res[0].a);
        })
      });
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
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then(() => {
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

    it('should remove by primitive id type', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1, _id: '1'}, {a: 2, _id: 2}])
      .then(() => {
        return db.remove('1');
      }).then((removedDocs) => {
        removedDocs.should.have.length(1);
        removedDocs[0].should.be.deep.equal({a: 1, _id: '1'});
        return db.remove(2);
      }).then((removedDocs) => {
        removedDocs.should.have.length(1);
        removedDocs[0].should.be.deep.equal({a: 2, _id: 2});
      });
    });
  });


  describe('#update', function () {
    it('should update a document', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1}, {a: 2}, {a: 3}]).then(() => {
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
      return db.update({}, {$set: {a: 1}}, {}).then(() => {
        cb.should.have.callCount(1);
      });
    });

    it('should be quiet if options.quiet passed', function () {
      const db = new Collection('test');
      const cb = sinon.spy();
      db.on('sync:update', cb);
      return db.update({}, {$set: {a: 1}}, {quiet: true}).then(() => {
        cb.should.have.callCount(0);
      });
    });

    it('should update index of a doucmnet', function () {
      // TODO
    });

    it('should update by primitive id type', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1, _id: '1'}, {a: 2, _id: 2}])
      .then(() => {
        return db.update('1', {$set: {a: 3}});
      }).then((res) => {
        res.updated.should.have.length(1);
        res.updated[0].should.be.deep.equal({a: 3, _id: '1'});
        return db.update(2, {$set: {a: 4}});
      }).then((res) => {
        res.updated.should.have.length(1);
        res.updated[0].should.be.deep.equal({a: 4, _id: 2});
      });
    });
  });

  describe('#update - upsert', function () {
    const db = new Collection('test');
    const testUpsert = (query, mod, expected, expectedId) => {
      it(`should upsert with ${JSON.stringify(query)} ${JSON.stringify(mod)},\n\textected ${JSON.stringify(expected)}`, function() {
        return db.remove({}, {multi: true}).then(() => {
          return db.update(query, mod, {upsert: true}).then((res) => {
            res.modified.should.be.equals(1);
            res.original.should.be.deep.equals([null]);
            res.updated.should.have.length(1);
            if (expectedId) {
              res.updated[0]._id.should.be.equal(expectedId);
            } else {
              expect(res.updated[0]._id).to.have.length(17);
            }
            delete res.updated[0]._id;
            res.updated[0].should.be.deep.equals(expected);
          });
        });
      });
    };

    testUpsert({a: 2}, {$set: {b: 3}}, {a: 2, b: 3})
    testUpsert({'a.b.c': 2}, {$set: {b: 3}}, {a: {b: {c: 2}}, b: 3})
    testUpsert({'a.b.c': 2, _id: {$in: [1,2,3]}}, {$set: {b: 3}}, {a: {b: {c: 2}}, b: 3})
    testUpsert({'a.b.c': 2, _id: 123}, {$set: {b: 3}}, {a: {b: {c: 2}}, b: 3}, 123)
    testUpsert({a: 2}, {b: 3}, {b: 3})
    testUpsert({a: 2}, {$unset: {a: 1}}, {})
    testUpsert({a: 2, _id: '123'}, {$setOnInsert: {a: 1, _id: '123'}}, {a: 1}, '123');
    testUpsert(null, {b: 3}, {b: 3});
    testUpsert('test', {b: 3}, {b: 3}, 'test');
    testUpsert({_id: null}, {b: 3}, {b: 3});
    testUpsert({_id: 'test'}, {b: 3}, {b: 3}, 'test');
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

    it('should find one by primitive id type', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1, _id: '1'}, {a: 2, _id: 2}])
      .then(() => {
        return db.findOne('1');
      }).then((res) => {
        res.should.be.deep.equal({a: 1, _id: '1'});
        return db.findOne(2);
      }).then((res) => {
        res.should.be.deep.equal({a: 2, _id: 2});
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

    it('should count by primitive id type', function () {
      const db = new Collection('test');
      return db.insertAll([{a: 1, _id: '1'}, {a: 2, _id: 2}])
      .then(() => {
        return db.count('1');
      }).then((res) => {
        res.should.be.deep.equal(1);
        return db.count(2);
      }).then((res) => {
        res.should.be.deep.equal(1);
        return db.count('2');
      }).then((res) => {
        res.should.be.deep.equal(0);
        return db.count(1);
      }).then((res) => {
        res.should.be.deep.equal(0);
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

    it('should return ids by primitive id type', function () {
      const db = new Collection('test');
      return Promise.all([
        db.insert({a: 1, _id: 1}),
        db.insert({a: 2, _id: 2}),
        db.insert({a: 3, _id: 3}),
      ]).then((docs) => {
        return db.ids(1);
      }).then((ids) => {
        expect(ids).to.be.an('array');
        ids.should.have.length(1);
        ids[0].should.be.equal(1);
        return db.ids('1');
      }).then((ids) => {
        expect(ids).to.be.an('array');
        ids.should.have.length(0);
      });
    });
  });
});
