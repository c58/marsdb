import MapIndex from '../../lib/MapIndex';
import chai, {expect, assert} from 'chai';
import sinon from 'sinon';
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
chai.should();

describe('MapIndex', () => {

  let mapIndex;
  beforeEach(function() {
    mapIndex = new MapIndex('_id');
  });

  describe('#constructor', function () {
    it('should create empty map index', function () {
      Object.keys(mapIndex.mapIndex).length.should.be.equal(0);
    });

    it('should create lookup function', function () {
      (typeof mapIndex.lookupFunction).should.be.equal('function');
    });

    it('should save keyName and unique, sparse options', function () {
      // Without options
      mapIndex.keyName.should.be.equal('_id');
      mapIndex.unique.should.be.equal(false);
      mapIndex.sparse.should.be.equal(false);

      // With options
      mapIndex = new MapIndex('_id', {unique: true, sparse: true});
      mapIndex.keyName.should.be.equal('_id');
      mapIndex.unique.should.be.equal(true);
      mapIndex.sparse.should.be.equal(true);
    });
  });

  describe('#operations', function() {
    it('should insert document in index collection', function () {
      let doc;

      // Insert document with null/undefined key value mustn't be successfully
      doc = {_id: null, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
      doc = {_id: undefined, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);

      // Insert String must be successfully
      doc = {_id: 'testId', name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);

      // Insert Number must be successfully
      doc = {_id: 123, name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);

      // Insert Date must be successfully
      doc = {_id: new Date(), name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);

      // Another types of index mustn't be insert successfully
      doc = {_id: [1,2], name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
      doc = {_id: {_id: 0}, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);

      doc = {_id: '123', name: 'test'};

      // Don't unique
      mapIndex = new MapIndex('_id');
      mapIndex.insert(doc);
      mapIndex.getMatching('123').should.be.deep.equal(['123']);

      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);

      // Unique
      mapIndex = new MapIndex('name', {unique: true});
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      (() => mapIndex.insert(doc)).should.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);

    });

    it('should remove document in index collection', function () {
      let doc1 = {_id: '123', name: new Date(10)};
      let doc2 = {_id: '456', name: 'test'};

      // If doctument has indexed field
      // If index is unique
      mapIndex = new MapIndex('name', {unique: true});

      mapIndex.insert(doc1);
      mapIndex.getMatching(new Date(10)).should.be.deep.equal(['123']);

      mapIndex.remove(doc1);
      mapIndex.getMatching('test').should.be.deep.equal([]);

      // If index isn't unique
      mapIndex = new MapIndex('name');

      mapIndex.insert(doc1);
      mapIndex.insert(doc2);

      mapIndex.remove(doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['456']);
      mapIndex.remove(doc2);
      mapIndex.getMatching('test').should.be.deep.equal([]);

      // If doctument has no indexed field
      let doc = {_id: '123', data: 'test'};

      (() => mapIndex.remove(doc)).should.throw(Error);
    });

    it('should update document in index collection', function () {
      let doc = {_id: '123', name: 'test'};
      let doc1 = {_id: '123', name: 'test1'};
      let doc2 = {_id: '456', name: 'test1'};

      // Old is exist and new isn't exist (just update)
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']); // no field and getAll
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);

      // Update if old and new aren't exist (just insert new)
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['456']); // no field and getAll
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);

      // Update if old isn't exist and new exists (do nothing)
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);

      // Update if old and new are exist (just remove old)
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
      mapIndex.update(doc, doc1);
      mapIndex.getMatching('test').should.be.deep.equal([]); // has field but empty
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
    });

    it('should do revert update document in index collection', function() {
      let doc = {_id: '0', name: 'test'};
      let doc1 = {_id: '1', name: 'test'};
      let doc2 = {_id: '2', name: 'test'};
      let doc3 = {_id: '3', name: 'test3'};
      let doc4 = {_id: '1', name: 'test3'};

      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.insert(doc3);
      mapIndex.getMatching('test').should.be.deep.equal(['0', '1', '2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);
      mapIndex.update(doc1, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0','2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3', '1']);
      mapIndex.revertUpdate(doc1, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0','2', '1']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);

    });

    it('should reset index collection', function () {
      let doc1 = {_id: '123', name: 'test'};
      let doc2 = {_id: '456', name: 'test'};

      mapIndex.insert(doc1);
      mapIndex.insert(doc2);

      mapIndex.mapIndex.should.be.deep.equal({'123': ['123'], '456': ['456']});
      mapIndex.reset();
      mapIndex.mapIndex.should.be.deep.equal({});
    });

  });

  describe('getMatching(value)', function() {
    it('should return documents ids array from index collection by value', function () {
      let doc1 = {_id: '123', name: 3};
      let doc2 = {_id: '456', name: 3};

      mapIndex = new MapIndex('name');
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching(3).should.be.deep.equal(['123', '456']);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']);
    });
  });

  describe('getAll()', function() {
    it('should return all documents ids array from index collection', function () {
      let doc1 = {_id: '1', name: 'test'};
      let doc2 = {_id: '2', name: 'test'};
      let doc3 = {_id: '3', name: 'test1'};
      let doc4 = {_id: '4', name: 'test2'};

      mapIndex = new MapIndex('name');
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.insert(doc3);
      mapIndex.insert(doc4);
      mapIndex.getAll().should.be.deep.equal(['1', '2', '3', '4']);
    });
  });

 });