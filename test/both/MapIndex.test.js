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

    it('should save keyName and without unique option are false by default', function () {
      mapIndex.keyName.should.be.equal('_id');
      mapIndex.unique.should.be.equal(false);
    });

    it('should save keyName with unique option', function () {
      mapIndex = new MapIndex('_id', {unique: true});
      mapIndex.keyName.should.be.equal('_id');
      mapIndex.unique.should.be.equal(true);
    });
  });

  describe('#insert', function() {
    let doc;

    it('should do nothing when try to insert a document without indexed field', function () {
      mapIndex = new MapIndex('data');
      doc = {_id: 0, name: 'test'};
      mapIndex.getMatching().should.be.deep.equal([]);
      mapIndex.insert(doc);
      mapIndex.getMatching().should.be.deep.equal([]);
    });

    it('should insert when try to insert a document with null/undefined indexed field which is not _id field', function () {
      mapIndex = new MapIndex('name');
      doc = {_id: 0, name: null};
      (() => mapIndex.insert(doc)).should.not.throw(Error);
      // console.log(mapIndex.mapIndex);
      mapIndex.getMatching(null).should.be.deep.equal([0]);
      doc = {_id: 1, name: undefined};
      (() => mapIndex.insert(doc)).should.not.throw(Error);
      // console.log(mapIndex.mapIndex);
      mapIndex.getMatching(undefined).should.be.deep.equal([1]);
    });

    it('should throw an error when try to insert a document with null/undefined indexed field', function () {
      doc = {_id: null, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
      doc = {_id: undefined, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
    });

    it('should insert a document with indexed field type String', function () {
      mapIndex = new MapIndex('name');
      doc = {_id: 'testId', name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal(['testId']);
    });

    it('should insert a document with indexed field type Number', function () {
      mapIndex = new MapIndex('name');
      doc = {_id: 123, name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal([123]);
    });

    it('should insert a document with indexed field type Date', function () {
      mapIndex = new MapIndex('name');
      doc = {_id: new Date(10), name: 'test'};
      (() => mapIndex.insert(doc)).should.not.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal([new Date(10)]);
    });

    it(`should throw an error when try to insert a document with
      indexed field type different from String, Number, Date`, function () {
      doc = {_id: [1,2], name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
      doc = {_id: {_id: 0}, name: 'test'};
      (() => mapIndex.insert(doc)).should.throw(Error);
    });

    it(`should insert a document with indexed field value already existed
      in index and index was created without unique option`, function () {
      doc = {_id: '123', name: 'test'};
      let doc1 = {_id: '456', name: 'test'};

      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.insert(doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']);
    });

    it(`should throw an error when try to insert document with indexed field value
      already existed in index and index was created with unique option`, function () {
      doc = {_id: '123', name: 'test'};
      let doc1 = {_id: '456', name: 'test'};
      mapIndex = new MapIndex('name', {unique: true});
      mapIndex.insert(doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      (() => mapIndex.insert(doc)).should.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      (() => mapIndex.insert(doc1)).should.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
    });
  });

  describe('#remove', function() {
    let doc1 = {_id: '123', name: 'test'};
    let doc2 = {_id: '456', name: 'test'};

    it('should remove a document from index if document has indexed field and index was defined as unique', function () {
      mapIndex = new MapIndex('name', {unique: true});

      mapIndex.insert(doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);

      mapIndex.remove(doc1);
      mapIndex.getMatching('test').should.be.deep.equal([]);
    });

    it('should remove a document from index if document has indexed field and index was not defined as unique', function () {
      mapIndex = new MapIndex('name');

      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']);
      mapIndex.remove(doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['456']);
      mapIndex.remove(doc2);
      mapIndex.getMatching('test').should.be.deep.equal([]);
    });

    it('should do nothing when try to remove document from index if document has no indexed field', function () {
      let doc = {_id: 0, data: 'test'};
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']);
      (() => mapIndex.remove(doc)).should.not.throw(Error);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']);
    });
  });

  describe('#update', function() {
    let doc = {_id: '123', name: 'test'};
    let doc1 = {_id: '123', name: 'test1'};
    let doc2 = {_id: '456', name: 'test1'};

    it('should update a document in index collection if: old is exist and new is not exist (do just update)', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']); // no field and getAll
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
    });

    it('should update a document in index collection if: old and new are not exist (do just insert new)', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['456']); // no field and getAll
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
    });

    it('should update a document in index collection if: old is not exist and new exists (do nothing)', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
      mapIndex.update(doc1, doc);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
    });

    it('should update a document in index collection if: old and new are exist (just remove old)', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
      mapIndex.update(doc, doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['123', '456']); // no field and getAll
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
    });
    it('should insert a document in index collection if: old is null and new is not null', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['123']);
      mapIndex.update(null, doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
    });
    it('should remove a document in index collection if: old is not null and new is null', function () {
      mapIndex = new MapIndex('name');
      mapIndex.insert(doc);
      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['123', '456']);
      mapIndex.update(doc1, null);
      mapIndex.getMatching('test').should.be.deep.equal(['123']);
      mapIndex.getMatching('test1').should.be.deep.equal(['456']);
    });
  });

  describe('#revertUpdate', function() {
    it('should do revert update a document in index collection', function() {
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

    it('should do revert update a document in index collection with null old document', function() {
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
      mapIndex.update(null, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0','1', '2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3', '1']);
      mapIndex.revertUpdate(null, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0','1', '2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);
      mapIndex.update(null, doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['0','1', '2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);
      mapIndex.revertUpdate(null, doc1);
      mapIndex.getMatching('test').should.be.deep.equal(['0', '2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);
      mapIndex.update(doc1, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0','2']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3', '1']);
      mapIndex.revertUpdate(doc1, doc4);
      mapIndex.getMatching('test').should.be.deep.equal(['0', '2', '1']);
      mapIndex.getMatching('test3').should.be.deep.equal(['3']);
    });
  });

  describe('#reset', function() {
    it('should reset index collection', function () {
      let doc1 = {_id: '123', name: 'test'};
      let doc2 = {_id: '456', name: 'test'};
      const res = new Map([['123', '123'], ['456','456']]);

      mapIndex.insert(doc1);
      mapIndex.insert(doc2);
      mapIndex.mapIndex.should.be.deep.equal(res);
      mapIndex.reset();
      mapIndex.mapIndex.should.be.deep.equal(new Map());
    });
  });

  describe('#getMatching', function() {
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

  describe('#getAll', function() {
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