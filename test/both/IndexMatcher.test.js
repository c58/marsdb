import documentMatchingTest from './MatchingTests';
import IndexMatcher, * as IndexMatcherInternals from '../lib/IndexMatcher';
import EJSON from '../lib/EJSON';
import Collection from '../lib/Collection';
import Index from '../lib/Index';
import chai, {except, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('IndexMatcher', () => {

  describe('Internalts', () => {
    it('should intersecting including', () => {
      const a = ['a', 'b', 'c'];
      const b = ['b', 'e', 'k'];
      const c = ['c', 'b', 'l'];
      const res = IndexMatcherInternals._getIncludeIntersection([a, b, c]);
      res.should.be.deep.equal(['b']);
    });

    it('should intersecting excluding', () => {
      const a = ['a', 'b', 'c'];
      const b = ['b', 'e', 'k'];
      const c = ['c', 'b', 'l'];
      const res = IndexMatcherInternals._getExcludeIntersection([a, b, c]);
      res.should.be.deep.equal(['a']);
    });

    it('should intersecting including with undefs', () => {
      const a = ['a', 'b', 'c'];
      const b = ['b', 'e', 'k'];
      const c = ['c', 'b', 'l'];
      const res = IndexMatcherInternals._getExcludeIntersection(
        [undefined, undefined, a, undefined, b, c, undefined]
      );
      res.should.be.deep.equal(['a']);
    });

    it('should unios', () => {
      const a = ['a', 'b', 'c'];
      const b = ['b', 'e', 'k'];
      const c = ['c', 'b', 'l'];
      const res = IndexMatcherInternals._getUnion([a, b, c]);
      res.should.be.deep.equal(['a', 'b', 'c', 'e', 'k', 'l']);
    });

    it('should make match result from scratch', () => {
      const res = IndexMatcherInternals._makeMatchResult({
        include: ['a', 'b', 'c'],
        exclude: ['c', 'd', 'e'],
      });
      res.should.be.deep.equal({
        include: ['a', 'b', 'c'],
        exclude: ['c', 'd', 'e'],
      });
    });

    it('should make match result from base result', () => {
      const base = {include: ['a'], exclude: ['b']};
      IndexMatcherInternals._makeMatchResult({
        include: ['a', 'b', 'c'],
        exclude: ['c', 'd', 'e'],
      }, base);
      base.should.be.deep.equal({
        include: ['a', 'a', 'b', 'c'],
        exclude: ['b', 'c', 'd', 'e'],
      });
    });
  });

  describe('Match stream', () => {
    let db;
    beforeEach(function () {
      db = new Collection('test');

      return Promise.all([
        db.insert({text: 'little text 1', numbr: 10, _id: 'id1', nested: {'_id': 'id1'}}),
        db.insert({text: 'little text 2', numbr: 11, _id: 'id2', nested: {'_id': 'id2'}}),
        db.insert({text: 'little text 3', numbr: 12, _id: 'id3', nested: {'_id': 'id3'}}),
        db.insert({text: 'little text 4', numbr: 13, _id: 'id4', nested: {'_id': 'id4'}}),
        db.insert({text: 'little text 5', numbr: 14, _id: 'id5', nested: {'_id': 'id5'}}),
        db.insert({text: 'little text 6', numbr: 15, _id: 'id6', nested: {'_id': 'id6'}}),
        db.insert({text: 'little text 7', numbr: 16, _id: 'id7', nested: {'_id': 'id7'}}),
      ]);
    });

    it('should get ids with _id request', () => {
      return new IndexMatcher(db,
        {'_id': 'id2'}
      );
    });

    it('should get ids with logical request', () => {
      return new IndexMatcher(db, {
        $and: [
          {_id: {$in: ['id1', 'id2', 'id3']}},
          {$or: [
            {'nested._id': 'id1'},
            {'nested._id': 'id3'}
          ]},
        ],
      });
    });

    it('should get ids with _id request and sorting', () => {
      return new IndexMatcher(db,
        {_id: {$in: ['id3', 'id4', 'id2']}, numbr: {$gt: 11}},
        {numbr: -1}
      );
    });
  });

  describe('Minimongo tests', function () {
    var matches = function (shouldMatch, selector, doc) {
      const db = new Collection('test');
      return db.insert(doc).then((result) => {
        return db.find(selector);
      }).then((docs) => {
        const result = docs.length > 0;
        if (result !== shouldMatch) {
          console.log(shouldMatch);
          console.log('doc: ', JSON.stringify(doc));
          console.log('selector: ', JSON.stringify(selector));
          const mess = `minimongo match failure: document ${shouldMatch ? 'should match, but doesn\'t' : 'shouldn\'t match, but does'}, selector ${EJSON.stringify(selector)}, document ${EJSON.stringify(doc)}`;
          assert.fail(result, shouldMatch, mess)
        }
      })
    };

    var match = matches.bind(null, true);
    var nomatch = matches.bind(null, false);
    documentMatchingTest(match, nomatch);
  });
});
