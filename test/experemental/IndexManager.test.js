import Collection from '../lib/Collection';
import IndexManager from '../lib/IndexManager';
import Index from '../lib/Index';
import async from 'async';
import chai from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('IndexManager', () => {
  let db, idxMan;
  beforeEach(function () {
    db = new Collection('test')
    idxMan = db.indexManager;
  });

  it('should be created with _id index', () => {
    idxMan.indexes['_id'].should.be.instanceof(Index);
  });



  describe('#buildIndex', function () {
    it('should build an existing index', function () {
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6})
      ]).then(() => {
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
        idxMan.indexes._id.reset();
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([]);
        return idxMan.buildIndex('_id');
      }).then(() => {
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
      });
    });

    it('should throw an error when no index found to build', function () {
      // TODO
    });

    it('should reject with error when building some index failed', function () {
      // TODO
    });
  });



  describe('#buildAllIndexes', function () {
    it('should build all existing indexes', function () {
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6}),
        idxMan.ensureIndex({fieldName: 'b'})
      ]).then(() => {
        idxMan.indexes.b.getBetweenBounds({$lt: 6, $gt: 2})
        .should.be.deep.equal([2, 3, 4]);
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);

        idxMan.indexes.b.reset();
        idxMan.indexes._id.reset();

        idxMan.indexes.b.getBetweenBounds({$lt: 6, $gt: 2})
        .should.be.deep.equal([]);
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([]);

        return idxMan.buildAllIndexes();
      }).then(() => {
        idxMan.indexes.b.getBetweenBounds({$lt: 6, $gt: 2})
        .should.be.deep.equal([2, 3, 4]);
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
      });
    });
  });



  describe('#ensureIndex', function () {
    it('should create and build index when index does not exists', () => {
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6})
      ]).then(() => {
        return idxMan.ensureIndex({fieldName: 'b'});
      }).then(() => {
        idxMan.indexes['b'].should.be.instanceof(Index);
        idxMan.indexes['b'].getBetweenBounds({$lt: 6, $gt: 2})
        .should.be.deep.equal([2, 3, 4]);
      });
    });

    it('should return resolved promise when index exists and built', () => {
      const prevIndex = idxMan.indexes._id;
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6})
      ]).then(() => {
        return idxMan.ensureIndex({fieldName: '_id'});
      }).then(() => {
        prevIndex.should.be.equal(idxMan.indexes._id);
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
      });
    });

    it('should return promise for already running index building task', () => {
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6})
      ]).then(() => {
        const runProm = idxMan.ensureIndex({fieldName: '_id', forceRebuild: true});
        const anotherRunProm = idxMan.ensureIndex({fieldName: '_id', forceRebuild: true});
        runProm.should.be.equal(anotherRunProm);
      });
    });

    it('should be able to force rebuild indexes', () => {
      return Promise.all([
        db.insert({_id: 1, a: '1', b: 2}),
        db.insert({_id: 2, a: '2', b: 3}),
        db.insert({_id: 3, a: '3', b: 4}),
        db.insert({_id: 4, a: '4', b: 5}),
        db.insert({_id: 5, a: '5', b: 6})
      ]).then(() => {
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
        idxMan.indexes._id.reset();
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([]);
        return idxMan.ensureIndex({fieldName: '_id', forceRebuild: true});
      }).then(() => {
        idxMan.indexes._id.getBetweenBounds({$lte: 3, $gt: 1})
        .should.be.deep.equal([2, 3]);
      });
    });
  });



  describe('#removeIndex', function () {
    it('should remove index', function () {
      return idxMan.removeIndex().then(() => {
        idxMan.indexes.should.not.have.equal('_id');
      });
    });
  });



  describe('#indexDocument', function () {
    it('should index document in all existing indexes', function () {
      return Promise.all([
        idxMan.ensureIndex({fieldName: 'b', unique: true}),
        idxMan.ensureIndex({fieldName: 'a'})
      ]).then(() => {
        return idxMan.indexDocument({_id: 5, a: '5', b: 6});
      }).then(() => {
        idxMan.indexes._id.getMatching(5)
        .should.be.deep.equal([5]);
        idxMan.indexes.b.getMatching(6)
        .should.be.deep.equal([5]);
        idxMan.indexes.a.getMatching('5')
        .should.be.deep.equal([5]);
      });
    });

    it('should reject and rollback index when indexing errored', function () {
      return Promise.all([
        idxMan.ensureIndex({fieldName: 'b', unique: true}),
        idxMan.ensureIndex({fieldName: 'a'}),
        idxMan.indexDocument({_id: 5, a: '5', b: 6})
      ]).then(() => {
        return idxMan.indexDocument({_id: 4, a: '7', b: 6});
      }).then(null, (err) => {
        err.should.not.be.equal(undefined);
        idxMan.indexes._id.getMatching(4)
        .should.be.deep.equal([]);
        idxMan.indexes.a.getMatching('7')
        .should.be.deep.equal([]);
        idxMan.indexes.b.getMatching(6)
        .should.be.deep.equal([5]);
      });
    });
  });



  describe('#reindexDocument', function () {
    it('should reindex document in all existing indexes', function () {
      return Promise.all([
        idxMan.ensureIndex({fieldName: 'b', unique: true}),
        idxMan.ensureIndex({fieldName: 'a'}),
        idxMan.indexDocument({_id: 5, a: '5', b: 6})
      ]).then(() => {
        return idxMan.reindexDocument(
          {_id: 5, a: '5', b: 6},
          {_id: 5, a: '6', b: 7}
        );
      }).then(() => {
        idxMan.indexes._id.getMatching(5)
        .should.be.deep.equal([5]);
        idxMan.indexes.b.getMatching(7)
        .should.be.deep.equal([5]);
        idxMan.indexes.a.getMatching('6')
        .should.be.deep.equal([5]);
        idxMan.indexes.b.getMatching(6)
        .should.be.deep.equal([]);
        idxMan.indexes.a.getMatching('5')
        .should.be.deep.equal([]);
      });
    });

    it('should reject and rollback index when reindexing errored', function () {
      return Promise.all([
        idxMan.ensureIndex({fieldName: 'b', unique: true}),
        idxMan.ensureIndex({fieldName: 'a'}),
        idxMan.indexDocument({_id: 5, a: '5', b: 6}),
        idxMan.indexDocument({_id: 10, a: '10', b: 5})
      ]).then(() => {
        return idxMan.reindexDocument(
          {_id: 10, a: '10', b: 5},
          {_id: 10, a: '7', b: 6}
        );
      }).then(null, (err) => {
        err.should.not.be.equal(undefined);
        idxMan.indexes._id.getMatching(10)
        .should.be.deep.equal([10]);
        idxMan.indexes.a.getMatching('10')
        .should.be.deep.equal([10]);
        idxMan.indexes.a.getMatching('7')
        .should.be.deep.equal([]);
        idxMan.indexes.b.getMatching(5)
        .should.be.deep.equal([10]);
        idxMan.indexes.b.getMatching(6)
        .should.be.deep.equal([5]);
      });
    });
  });



  describe('#deindexDocument', function () {
    it('should deindex document in all existing indexes', function () {
      return Promise.all([
        idxMan.ensureIndex({fieldName: 'b', unique: true}),
        idxMan.ensureIndex({fieldName: 'a'}),
        idxMan.indexDocument({_id: 5, a: '5', b: 6})
      ]).then(() => {
        return idxMan.deindexDocument({_id: 5, a: '5', b: 6});
      }).then(() => {
        idxMan.indexes._id.getMatching(5)
        .should.be.deep.equal([]);
        idxMan.indexes.b.getMatching(6)
        .should.be.deep.equal([]);
        idxMan.indexes.a.getMatching('5')
        .should.be.deep.equal([]);
      });
    });
  });


});
