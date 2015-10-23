import EJSON from '../../lib/EJSON';
import DocumentMatcher, {makeLookupFunction} from '../../lib/DocumentMatcher';
import chai, {except, assert} from 'chai';
import _ from 'lodash';
chai.use(require('chai-as-promised'));
chai.should();


describe('DocumentMatcher', () => {

    it("#makeLookupFunction", function () {
      var lookupA = makeLookupFunction('a');
      assert.deepEqual(lookupA({}), [{value: undefined}]);
      assert.deepEqual(lookupA({a: 1}), [{value: 1}]);
      assert.deepEqual(lookupA({a: [1]}), [{value: [1]}]);

      var lookupAX = makeLookupFunction('a.x');
      assert.deepEqual(lookupAX({a: {x: 1}}), [{value: 1}]);
      assert.deepEqual(lookupAX({a: {x: [1]}}), [{value: [1]}]);
      assert.deepEqual(lookupAX({a: 5}), [{value: undefined}]);
      assert.deepEqual(lookupAX({a: [{x: 1}, {x: [2]}, {y: 3}]}),
                 [{value: 1, arrayIndices: [0]},
                  {value: [2], arrayIndices: [1]},
                  {value: undefined, arrayIndices: [2]}]);

      var lookupA0X = makeLookupFunction('a.0.x');
      assert.deepEqual(lookupA0X({a: [{x: 1}]}), [
        // From interpreting '0' as "0th array element".
        {value: 1, arrayIndices: [0, 'x']},
        // From interpreting '0' as "after branching in the array, look in the
        // object {x:1} for a field named 0".
        {value: undefined, arrayIndices: [0]}]);
      assert.deepEqual(lookupA0X({a: [{x: [1]}]}), [
        {value: [1], arrayIndices: [0, 'x']},
        {value: undefined, arrayIndices: [0]}]);
      assert.deepEqual(lookupA0X({a: 5}), [{value: undefined}]);
      assert.deepEqual(lookupA0X({a: [{x: 1}, {x: [2]}, {y: 3}]}), [
        // From interpreting '0' as "0th array element".
        {value: 1, arrayIndices: [0, 'x']},
        // From interpreting '0' as "after branching in the array, look in the
        // object {x:1} for a field named 0".
        {value: undefined, arrayIndices: [0]},
        {value: undefined, arrayIndices: [1]},
        {value: undefined, arrayIndices: [2]}
      ]);

      assert.deepEqual(
        makeLookupFunction('w.x.0.z')({
          w: [{x: [{z: 5}]}]}), [
            // From interpreting '0' as "0th array element".
            {value: 5, arrayIndices: [0, 0, 'x']},
            // From interpreting '0' as "after branching in the array, look in the
            // object {z:5} for a field named "0".
            {value: undefined, arrayIndices: [0, 0]}
          ]);
    });

    describe('Matching', function () {
      var matches = function (shouldMatch, selector, doc) {
        var doesMatch = new DocumentMatcher(selector).documentMatches(doc).result;
        it(`should ${shouldMatch ? 'match' : 'NOT match'} document ${JSON.stringify(doc)}
            with query ${JSON.stringify(selector)}`, function() {
          assert.equal(doesMatch, shouldMatch);
        });
      };

      var match = _.bind(matches, null, true);
      var nomatch = _.bind(matches, null, false);

      // XXX blog post about what I learned while writing these tests (weird
      // mongo edge cases)

      // empty selectors
      match({}, {});
      match({}, {a: 12});

      // scalars
      match(1, {_id: 1, a: 'foo'});
      nomatch(1, {_id: 2, a: 'foo'});
      match('a', {_id: 'a', a: 'foo'});
      nomatch('a', {_id: 'b', a: 'foo'});

      // safety
      nomatch(undefined, {});
      nomatch(undefined, {_id: 'foo'});
      nomatch(false, {_id: 'foo'});
      nomatch(null, {_id: 'foo'});
      nomatch({_id: undefined}, {_id: 'foo'});
      nomatch({_id: false}, {_id: 'foo'});
      nomatch({_id: null}, {_id: 'foo'});

      // matching one or more keys
      nomatch({a: 12}, {});
      match({a: 12}, {a: 12});
      match({a: 12}, {a: 12, b: 13});
      match({a: 12, b: 13}, {a: 12, b: 13});
      match({a: 12, b: 13}, {a: 12, b: 13, c: 14});
      nomatch({a: 12, b: 13, c: 14}, {a: 12, b: 13});
      nomatch({a: 12, b: 13}, {b: 13, c: 14});

      match({a: 12}, {a: [12]});
      match({a: 12}, {a: [11, 12, 13]});
      nomatch({a: 12}, {a: [11, 13]});
      match({a: 12, b: 13}, {a: [11, 12, 13], b: [13, 14, 15]});
      nomatch({a: 12, b: 13}, {a: [11, 12, 13], b: [14, 15]});

      // dates
      var date1 = new Date;
      var date2 = new Date(date1.getTime() + 1000);
      match({a: date1}, {a: date1});
      nomatch({a: date1}, {a: date2});


      // arrays
      match({a: [1,2]}, {a: [1, 2]});
      match({a: [1,2]}, {a: [[1, 2]]});
      match({a: [1,2]}, {a: [[3, 4], [1, 2]]});
      nomatch({a: [1,2]}, {a: [3, 4]});
      nomatch({a: [1,2]}, {a: [[[1, 2]]]});

      // literal documents
      match({a: {b: 12}}, {a: {b: 12}});
      nomatch({a: {b: 12, c: 13}}, {a: {b: 12}});
      nomatch({a: {b: 12}}, {a: {b: 12, c: 13}});
      match({a: {b: 12, c: 13}}, {a: {b: 12, c: 13}});
      nomatch({a: {b: 12, c: 13}}, {a: {c: 13, b: 12}}); // tested on mongodb
      nomatch({a: {}}, {a: {b: 12}});
      nomatch({a: {b:12}}, {a: {}});
      match(
        {a: {b: 12, c: [13, true, false, 2.2, "a", null, {d: 14}]}},
        {a: {b: 12, c: [13, true, false, 2.2, "a", null, {d: 14}]}});
      match({a: {b: 12}}, {a: {b: 12}, k: 99});

      match({a: {b: 12}}, {a: [{b: 12}]});
      nomatch({a: {b: 12}}, {a: [[{b: 12}]]});
      match({a: {b: 12}}, {a: [{b: 11}, {b: 12}, {b: 13}]});
      nomatch({a: {b: 12}}, {a: [{b: 11}, {b: 12, c: 20}, {b: 13}]});
      nomatch({a: {b: 12, c: 20}}, {a: [{b: 11}, {b: 12}, {c: 20}]});
      match({a: {b: 12, c: 20}}, {a: [{b: 11}, {b: 12, c: 20}, {b: 13}]});

      // null
      match({a: null}, {a: null});
      match({a: null}, {b: 12});
      nomatch({a: null}, {a: 12});
      match({a: null}, {a: [1, 2, null, 3]}); // tested on mongodb
      nomatch({a: null}, {a: [1, 2, {}, 3]}); // tested on mongodb

      // order comparisons: $lt, $gt, $lte, $gte
      match({a: {$lt: 10}}, {a: 9});
      nomatch({a: {$lt: 10}}, {a: 10});
      nomatch({a: {$lt: 10}}, {a: 11});

      match({a: {$gt: 10}}, {a: 11});
      nomatch({a: {$gt: 10}}, {a: 10});
      nomatch({a: {$gt: 10}}, {a: 9});

      match({a: {$lte: 10}}, {a: 9});
      match({a: {$lte: 10}}, {a: 10});
      nomatch({a: {$lte: 10}}, {a: 11});

      match({a: {$gte: 10}}, {a: 11});
      match({a: {$gte: 10}}, {a: 10});
      nomatch({a: {$gte: 10}}, {a: 9});

      match({a: {$lt: 10}}, {a: [11, 9, 12]});
      nomatch({a: {$lt: 10}}, {a: [11, 12]});

      // (there's a full suite of ordering test elsewhere)
      nomatch({a: {$lt: "null"}}, {a: null});
      match({a: {$lt: {x: [2, 3, 4]}}}, {a: {x: [1, 3, 4]}});
      match({a: {$gt: {x: [2, 3, 4]}}}, {a: {x: [3, 3, 4]}});
      nomatch({a: {$gt: {x: [2, 3, 4]}}}, {a: {x: [1, 3, 4]}});
      nomatch({a: {$gt: {x: [2, 3, 4]}}}, {a: {x: [2, 3, 4]}});
      nomatch({a: {$lt: {x: [2, 3, 4]}}}, {a: {x: [2, 3, 4]}});
      match({a: {$gte: {x: [2, 3, 4]}}}, {a: {x: [2, 3, 4]}});
      match({a: {$lte: {x: [2, 3, 4]}}}, {a: {x: [2, 3, 4]}});

      nomatch({a: {$gt: [2, 3]}}, {a: [1, 2]}); // tested against mongodb

      // composition of two qualifiers
      nomatch({a: {$lt: 11, $gt: 9}}, {a: 8});
      nomatch({a: {$lt: 11, $gt: 9}}, {a: 9});
      match({a: {$lt: 11, $gt: 9}}, {a: 10});
      nomatch({a: {$lt: 11, $gt: 9}}, {a: 11});
      nomatch({a: {$lt: 11, $gt: 9}}, {a: 12});

      match({a: {$lt: 11, $gt: 9}}, {a: [8, 9, 10, 11, 12]});
      match({a: {$lt: 11, $gt: 9}}, {a: [8, 9, 11, 12]}); // tested against mongodb

      // $all
      match({a: {$all: [1, 2]}}, {a: [1, 2]});
      nomatch({a: {$all: [1, 2, 3]}}, {a: [1, 2]});
      match({a: {$all: [1, 2]}}, {a: [3, 2, 1]});
      match({a: {$all: [1, "x"]}}, {a: [3, "x", 1]});
      nomatch({a: {$all: ['2']}}, {a: 2});
      nomatch({a: {$all: [2]}}, {a: '2'});
      match({a: {$all: [[1, 2], [1, 3]]}}, {a: [[1, 3], [1, 2], [1, 4]]});
      nomatch({a: {$all: [[1, 2], [1, 3]]}}, {a: [[1, 4], [1, 2], [1, 4]]});
      match({a: {$all: [2, 2]}}, {a: [2]}); // tested against mongodb
      nomatch({a: {$all: [2, 3]}}, {a: [2, 2]});

      nomatch({a: {$all: [1, 2]}}, {a: [[1, 2]]}); // tested against mongodb
      nomatch({a: {$all: [1, 2]}}, {}); // tested against mongodb, field doesn't exist
      nomatch({a: {$all: [1, 2]}}, {a: {foo: 'bar'}}); // tested against mongodb, field is not an object
      nomatch({a: {$all: []}}, {a: []});
      nomatch({a: {$all: []}}, {a: [5]});
      match({a: {$all: [/i/, /e/i]}}, {a: ["foo", "bEr", "biz"]});
      nomatch({a: {$all: [/i/, /e/i]}}, {a: ["foo", "bar", "biz"]});
      match({a: {$all: [{b: 3}]}}, {a: [{b: 3}]});
      // Members of $all other than regexps are *equality matches*, not document
      // matches.
      nomatch({a: {$all: [{b: 3}]}}, {a: [{b: 3, k: 4}]});
      assert.throws(function () {
        match({a: {$all: [{$gt: 4}]}}, {});
      });

      // $exists
      match({a: {$exists: true}}, {a: 12});
      nomatch({a: {$exists: true}}, {b: 12});
      nomatch({a: {$exists: false}}, {a: 12});
      match({a: {$exists: false}}, {b: 12});

      match({a: {$exists: true}}, {a: []});
      nomatch({a: {$exists: true}}, {b: []});
      nomatch({a: {$exists: false}}, {a: []});
      match({a: {$exists: false}}, {b: []});

      match({a: {$exists: true}}, {a: [1]});
      nomatch({a: {$exists: true}}, {b: [1]});
      nomatch({a: {$exists: false}}, {a: [1]});
      match({a: {$exists: false}}, {b: [1]});

      match({a: {$exists: 1}}, {a: 5});
      match({a: {$exists: 0}}, {b: 5});

      nomatch({'a.x':{$exists: false}}, {a: [{}, {x: 5}]});
      match({'a.x':{$exists: true}}, {a: [{}, {x: 5}]});
      match({'a.x':{$exists: true}}, {a: [{}, {x: 5}]});
      match({'a.x':{$exists: true}}, {a: {x: []}});
      match({'a.x':{$exists: true}}, {a: {x: null}});

      // $mod
      match({a: {$mod: [10, 1]}}, {a: 11});
      nomatch({a: {$mod: [10, 1]}}, {a: 12});
      match({a: {$mod: [10, 1]}}, {a: [10, 11, 12]});
      nomatch({a: {$mod: [10, 1]}}, {a: [10, 12]});
      _.each([
        5,
        [10],
        [10, 1, 2],
        "foo",
        {bar: 1},
        []
      ], function (badMod) {
        assert.throws(function () {
          match({a: {$mod: badMod}}, {a: 11});
        });
      });

      // $ne
      match({a: {$ne: 1}}, {a: 2});
      nomatch({a: {$ne: 2}}, {a: 2});
      match({a: {$ne: [1]}}, {a: [2]});

      nomatch({a: {$ne: [1, 2]}}, {a: [1, 2]}); // all tested against mongodb
      nomatch({a: {$ne: 1}}, {a: [1, 2]});
      nomatch({a: {$ne: 2}}, {a: [1, 2]});
      match({a: {$ne: 3}}, {a: [1, 2]});
      nomatch({'a.b': {$ne: 1}}, {a: [{b: 1}, {b: 2}]});
      nomatch({'a.b': {$ne: 2}}, {a: [{b: 1}, {b: 2}]});
      match({'a.b': {$ne: 3}}, {a: [{b: 1}, {b: 2}]});

      nomatch({a: {$ne: {x: 1}}}, {a: {x: 1}});
      match({a: {$ne: {x: 1}}}, {a: {x: 2}});
      match({a: {$ne: {x: 1}}}, {a: {x: 1, y: 2}});

      // This query means: All 'a.b' must be non-5, and some 'a.b' must be >6.
      match({'a.b': {$ne: 5, $gt: 6}}, {a: [{b: 2}, {b: 10}]});
      nomatch({'a.b': {$ne: 5, $gt: 6}}, {a: [{b: 2}, {b: 4}]});
      nomatch({'a.b': {$ne: 5, $gt: 6}}, {a: [{b: 2}, {b: 5}]});
      nomatch({'a.b': {$ne: 5, $gt: 6}}, {a: [{b: 10}, {b: 5}]});
      // Should work the same if the branch is at the bottom.
      match({a: {$ne: 5, $gt: 6}}, {a: [2, 10]});
      nomatch({a: {$ne: 5, $gt: 6}}, {a: [2, 4]});
      nomatch({a: {$ne: 5, $gt: 6}}, {a: [2, 5]});
      nomatch({a: {$ne: 5, $gt: 6}}, {a: [10, 5]});

      // $in
      match({a: {$in: [1, 2, 3]}}, {a: 2});
      nomatch({a: {$in: [1, 2, 3]}}, {a: 4});
      match({a: {$in: [[1], [2], [3]]}}, {a: [2]});
      nomatch({a: {$in: [[1], [2], [3]]}}, {a: [4]});
      match({a: {$in: [{b: 1}, {b: 2}, {b: 3}]}}, {a: {b: 2}});
      nomatch({a: {$in: [{b: 1}, {b: 2}, {b: 3}]}}, {a: {b: 4}});

      match({a: {$in: [1, 2, 3]}}, {a: [2]}); // tested against mongodb
      match({a: {$in: [{x: 1}, {x: 2}, {x: 3}]}}, {a: [{x: 2}]});
      match({a: {$in: [1, 2, 3]}}, {a: [4, 2]});
      nomatch({a: {$in: [1, 2, 3]}}, {a: [4]});

      match({a: {$in: ['x', /foo/i]}}, {a: 'x'});
      match({a: {$in: ['x', /foo/i]}}, {a: 'fOo'});
      match({a: {$in: ['x', /foo/i]}}, {a: ['f', 'fOo']});
      nomatch({a: {$in: ['x', /foo/i]}}, {a: ['f', 'fOx']});

      match({a: {$in: [1, null]}}, {});
      match({'a.b': {$in: [1, null]}}, {});
      match({'a.b': {$in: [1, null]}}, {a: {}});
      match({'a.b': {$in: [1, null]}}, {a: {b: null}});
      nomatch({'a.b': {$in: [1, null]}}, {a: {b: 5}});
      nomatch({'a.b': {$in: [1]}}, {a: {b: null}});
      nomatch({'a.b': {$in: [1]}}, {a: {}});
      nomatch({'a.b': {$in: [1, null]}}, {a: [{b: 5}]});
      match({'a.b': {$in: [1, null]}}, {a: [{b: 5}, {}]});
      nomatch({'a.b': {$in: [1, null]}}, {a: [{b: 5}, []]});
      nomatch({'a.b': {$in: [1, null]}}, {a: [{b: 5}, 5]});

      // $nin
      nomatch({a: {$nin: [1, 2, 3]}}, {a: 2});
      match({a: {$nin: [1, 2, 3]}}, {a: 4});
      nomatch({a: {$nin: [[1], [2], [3]]}}, {a: [2]});
      match({a: {$nin: [[1], [2], [3]]}}, {a: [4]});
      nomatch({a: {$nin: [{b: 1}, {b: 2}, {b: 3}]}}, {a: {b: 2}});
      match({a: {$nin: [{b: 1}, {b: 2}, {b: 3}]}}, {a: {b: 4}});

      nomatch({a: {$nin: [1, 2, 3]}}, {a: [2]}); // tested against mongodb
      nomatch({a: {$nin: [{x: 1}, {x: 2}, {x: 3}]}}, {a: [{x: 2}]});
      nomatch({a: {$nin: [1, 2, 3]}}, {a: [4, 2]});
      nomatch({'a.b': {$nin: [1, 2, 3]}}, {a: [{b:4}, {b:2}]});
      match({a: {$nin: [1, 2, 3]}}, {a: [4]});
      match({'a.b': {$nin: [1, 2, 3]}}, {a: [{b:4}]});

      nomatch({a: {$nin: ['x', /foo/i]}}, {a: 'x'});
      nomatch({a: {$nin: ['x', /foo/i]}}, {a: 'fOo'});
      nomatch({a: {$nin: ['x', /foo/i]}}, {a: ['f', 'fOo']});
      match({a: {$nin: ['x', /foo/i]}}, {a: ['f', 'fOx']});

      nomatch({a: {$nin: [1, null]}}, {});
      nomatch({'a.b': {$nin: [1, null]}}, {});
      nomatch({'a.b': {$nin: [1, null]}}, {a: {}});
      nomatch({'a.b': {$nin: [1, null]}}, {a: {b: null}});
      match({'a.b': {$nin: [1, null]}}, {a: {b: 5}});
      match({'a.b': {$nin: [1]}}, {a: {b: null}});
      match({'a.b': {$nin: [1]}}, {a: {}});
      match({'a.b': {$nin: [1, null]}}, {a: [{b: 5}]});
      nomatch({'a.b': {$nin: [1, null]}}, {a: [{b: 5}, {}]});
      match({'a.b': {$nin: [1, null]}}, {a: [{b: 5}, []]});
      match({'a.b': {$nin: [1, null]}}, {a: [{b: 5}, 5]});

      // $size
      match({a: {$size: 0}}, {a: []});
      match({a: {$size: 1}}, {a: [2]});
      match({a: {$size: 2}}, {a: [2, 2]});
      nomatch({a: {$size: 0}}, {a: [2]});
      nomatch({a: {$size: 1}}, {a: []});
      nomatch({a: {$size: 1}}, {a: [2, 2]});
      nomatch({a: {$size: 0}}, {a: "2"});
      nomatch({a: {$size: 1}}, {a: "2"});
      nomatch({a: {$size: 2}}, {a: "2"});

      nomatch({a: {$size: 2}}, {a: [[2,2]]}); // tested against mongodb

      // $type
      match({a: {$type: 1}}, {a: 1.1});
      match({a: {$type: 1}}, {a: 1});
      nomatch({a: {$type: 1}}, {a: "1"});
      match({a: {$type: 2}}, {a: "1"});
      nomatch({a: {$type: 2}}, {a: 1});
      match({a: {$type: 3}}, {a: {}});
      match({a: {$type: 3}}, {a: {b: 2}});
      nomatch({a: {$type: 3}}, {a: []});
      nomatch({a: {$type: 3}}, {a: [1]});
      nomatch({a: {$type: 3}}, {a: null});
      match({a: {$type: 5}}, {a: EJSON.newBinary(0)});
      match({a: {$type: 5}}, {a: EJSON.newBinary(4)});
      nomatch({a: {$type: 5}}, {a: []});
      nomatch({a: {$type: 5}}, {a: [42]});
      nomatch({a: {$type: 7}}, {a: "1234567890abcd1234567890"});
      match({a: {$type: 8}}, {a: true});
      match({a: {$type: 8}}, {a: false});
      nomatch({a: {$type: 8}}, {a: "true"});
      nomatch({a: {$type: 8}}, {a: 0});
      nomatch({a: {$type: 8}}, {a: null});
      nomatch({a: {$type: 8}}, {a: ''});
      nomatch({a: {$type: 8}}, {});
      match({a: {$type: 9}}, {a: (new Date)});
      nomatch({a: {$type: 9}}, {a: +(new Date)});
      match({a: {$type: 10}}, {a: null});
      nomatch({a: {$type: 10}}, {a: false});
      nomatch({a: {$type: 10}}, {a: ''});
      nomatch({a: {$type: 10}}, {a: 0});
      nomatch({a: {$type: 10}}, {});
      match({a: {$type: 11}}, {a: /x/});
      nomatch({a: {$type: 11}}, {a: 'x'});
      nomatch({a: {$type: 11}}, {});

      // The normal rule for {$type:4} (4 means array) is that it NOT good enough to
      // just have an array that's the leaf that matches the path.  (An array inside
      // that array is good, though.)
      nomatch({a: {$type: 4}}, {a: []});
      nomatch({a: {$type: 4}}, {a: [1]}); // tested against mongodb
      match({a: {$type: 1}}, {a: [1]});
      nomatch({a: {$type: 2}}, {a: [1]});
      match({a: {$type: 1}}, {a: ["1", 1]});
      match({a: {$type: 2}}, {a: ["1", 1]});
      nomatch({a: {$type: 3}}, {a: ["1", 1]});
      nomatch({a: {$type: 4}}, {a: ["1", 1]});
      nomatch({a: {$type: 1}}, {a: ["1", []]});
      match({a: {$type: 2}}, {a: ["1", []]});
      match({a: {$type: 4}}, {a: ["1", []]}); // tested against mongodb
      // An exception to the normal rule is that an array found via numeric index is
      // examined itself, and its elements are not.
      match({'a.0': {$type: 4}}, {a: [[0]]});
      nomatch({'a.0': {$type: 1}}, {a: [[0]]});

      // regular expressions
      match({a: /a/}, {a: 'cat'});
      nomatch({a: /a/}, {a: 'cut'});
      nomatch({a: /a/}, {a: 'CAT'});
      match({a: /a/i}, {a: 'CAT'});
      match({a: /a/}, {a: ['foo', 'bar']});  // search within array...
      nomatch({a: /,/}, {a: ['foo', 'bar']});  // but not by stringifying
      match({a: {$regex: 'a'}}, {a: ['foo', 'bar']});
      nomatch({a: {$regex: ','}}, {a: ['foo', 'bar']});
      match({a: {$regex: /a/}}, {a: 'cat'});
      nomatch({a: {$regex: /a/}}, {a: 'cut'});
      nomatch({a: {$regex: /a/}}, {a: 'CAT'});
      match({a: {$regex: /a/i}}, {a: 'CAT'});
      match({a: {$regex: /a/, $options: 'i'}}, {a: 'CAT'}); // tested
      match({a: {$regex: /a/i, $options: 'i'}}, {a: 'CAT'}); // tested
      nomatch({a: {$regex: /a/i, $options: ''}}, {a: 'CAT'}); // tested
      match({a: {$regex: 'a'}}, {a: 'cat'});
      nomatch({a: {$regex: 'a'}}, {a: 'cut'});
      nomatch({a: {$regex: 'a'}}, {a: 'CAT'});
      match({a: {$regex: 'a', $options: 'i'}}, {a: 'CAT'});
      match({a: {$regex: '', $options: 'i'}}, {a: 'foo'});
      nomatch({a: {$regex: '', $options: 'i'}}, {});
      nomatch({a: {$regex: '', $options: 'i'}}, {a: 5});
      nomatch({a: /undefined/}, {});
      nomatch({a: {$regex: 'undefined'}}, {});
      nomatch({a: /xxx/}, {});
      nomatch({a: {$regex: 'xxx'}}, {});

      // GitHub issue #2817:
      // Regexps with a global flag ('g') keep a state when tested against the same
      // string. Selector shouldn't return different result for similar documents
      // because of this state.
      var reusedRegexp = /sh/ig;
      match({a: reusedRegexp}, {a: 'Shorts'});
      match({a: reusedRegexp}, {a: 'Shorts'});
      match({a: reusedRegexp}, {a: 'Shorts'});

      match({a: {$regex: reusedRegexp}}, {a: 'Shorts'});
      match({a: {$regex: reusedRegexp}}, {a: 'Shorts'});
      match({a: {$regex: reusedRegexp}}, {a: 'Shorts'});

      assert.throws(function () {
        match({a: {$options: 'i'}}, {a: 12});
      });

      match({a: /a/}, {a: ['dog', 'cat']});
      nomatch({a: /a/}, {a: ['dog', 'puppy']});

      // we don't support regexps in minimongo very well (eg, there's no EJSON
      // encoding so it won't go over the wire), but run these tests anyway
      match({a: /a/}, {a: /a/});
      match({a: /a/}, {a: ['x', /a/]});
      nomatch({a: /a/}, {a: /a/i});
      nomatch({a: /a/m}, {a: /a/});
      nomatch({a: /a/}, {a: /b/});
      nomatch({a: /5/}, {a: 5});
      nomatch({a: /t/}, {a: true});
      match({a: /m/i}, {a: ['x', 'xM']});

      assert.throws(function () {
        match({a: {$regex: /a/, $options: 'x'}}, {a: 'cat'});
      });
      assert.throws(function () {
        match({a: {$regex: /a/, $options: 's'}}, {a: 'cat'});
      });

      // $not
      match({x: {$not: {$gt: 7}}}, {x: 6});
      nomatch({x: {$not: {$gt: 7}}}, {x: 8});
      match({x: {$not: {$lt: 10, $gt: 7}}}, {x: 11});
      nomatch({x: {$not: {$lt: 10, $gt: 7}}}, {x: 9});
      match({x: {$not: {$lt: 10, $gt: 7}}}, {x: 6});

      match({x: {$not: {$gt: 7}}}, {x: [2, 3, 4]});
      match({'x.y': {$not: {$gt: 7}}}, {x: [{y:2}, {y:3}, {y:4}]});
      nomatch({x: {$not: {$gt: 7}}}, {x: [2, 3, 4, 10]});
      nomatch({'x.y': {$not: {$gt: 7}}}, {x: [{y:2}, {y:3}, {y:4}, {y:10}]});

      match({x: {$not: /a/}}, {x: "dog"});
      nomatch({x: {$not: /a/}}, {x: "cat"});
      match({x: {$not: /a/}}, {x: ["dog", "puppy"]});
      nomatch({x: {$not: /a/}}, {x: ["kitten", "cat"]});

      // dotted keypaths: bare values
      match({"a.b": 1}, {a: {b: 1}});
      nomatch({"a.b": 1}, {a: {b: 2}});
      match({"a.b": [1,2,3]}, {a: {b: [1,2,3]}});
      nomatch({"a.b": [1,2,3]}, {a: {b: [4]}});
      match({"a.b": /a/}, {a: {b: "cat"}});
      nomatch({"a.b": /a/}, {a: {b: "dog"}});
      match({"a.b.c": null}, {});
      match({"a.b.c": null}, {a: 1});
      match({"a.b": null}, {a: 1});
      match({"a.b.c": null}, {a: {b: 4}});

      // dotted keypaths, nulls, numeric indices, arrays
      nomatch({"a.b": null}, {a: [1]});
      match({"a.b": []}, {a: {b: []}});
      var big = {a: [{b: 1}, 2, {}, {b: [3, 4]}]};
      match({"a.b": 1}, big);
      match({"a.b": [3, 4]}, big);
      match({"a.b": 3}, big);
      match({"a.b": 4}, big);
      match({"a.b": null}, big);  // matches on slot 2
      match({'a.1': 8}, {a: [7, 8, 9]});
      nomatch({'a.1': 7}, {a: [7, 8, 9]});
      nomatch({'a.1': null}, {a: [7, 8, 9]});
      match({'a.1': [8, 9]}, {a: [7, [8, 9]]});
      nomatch({'a.1': 6}, {a: [[6, 7], [8, 9]]});
      nomatch({'a.1': 7}, {a: [[6, 7], [8, 9]]});
      nomatch({'a.1': 8}, {a: [[6, 7], [8, 9]]});
      nomatch({'a.1': 9}, {a: [[6, 7], [8, 9]]});
      match({"a.1": 2}, {a: [0, {1: 2}, 3]});
      match({"a.1": {1: 2}}, {a: [0, {1: 2}, 3]});
      match({"x.1.y": 8}, {x: [7, {y: 8}, 9]});
      // comes from trying '1' as key in the plain object
      match({"x.1.y": null}, {x: [7, {y: 8}, 9]});
      match({"a.1.b": 9}, {a: [7, {b: 9}, {1: {b: 'foo'}}]});
      match({"a.1.b": 'foo'}, {a: [7, {b: 9}, {1: {b: 'foo'}}]});
      match({"a.1.b": null}, {a: [7, {b: 9}, {1: {b: 'foo'}}]});
      match({"a.1.b": 2}, {a: [1, [{b: 2}], 3]});
      nomatch({"a.1.b": null}, {a: [1, [{b: 2}], 3]});
      // this is new behavior in mongo 2.5
      nomatch({"a.0.b": null}, {a: [5]});
      match({"a.1": 4}, {a: [{1: 4}, 5]});
      match({"a.1": 5}, {a: [{1: 4}, 5]});
      nomatch({"a.1": null}, {a: [{1: 4}, 5]});
      match({"a.1.foo": 4}, {a: [{1: {foo: 4}}, {foo: 5}]});
      match({"a.1.foo": 5}, {a: [{1: {foo: 4}}, {foo: 5}]});
      match({"a.1.foo": null}, {a: [{1: {foo: 4}}, {foo: 5}]});

      // trying to access a dotted field that is undefined at some point
      // down the chain
      nomatch({"a.b": 1}, {x: 2});
      nomatch({"a.b.c": 1}, {a: {x: 2}});
      nomatch({"a.b.c": 1}, {a: {b: {x: 2}}});
      nomatch({"a.b.c": 1}, {a: {b: 1}});
      nomatch({"a.b.c": 1}, {a: {b: 0}});

      // dotted keypaths: literal objects
      match({"a.b": {c: 1}}, {a: {b: {c: 1}}});
      nomatch({"a.b": {c: 1}}, {a: {b: {c: 2}}});
      nomatch({"a.b": {c: 1}}, {a: {b: 2}});
      match({"a.b": {c: 1, d: 2}}, {a: {b: {c: 1, d: 2}}});
      nomatch({"a.b": {c: 1, d: 2}}, {a: {b: {c: 1, d: 1}}});
      nomatch({"a.b": {c: 1, d: 2}}, {a: {b: {d: 2}}});

      // dotted keypaths: $ operators
      match({"a.b": {$in: [1, 2, 3]}}, {a: {b: [2]}}); // tested against mongodb
      match({"a.b": {$in: [{x: 1}, {x: 2}, {x: 3}]}}, {a: {b: [{x: 2}]}});
      match({"a.b": {$in: [1, 2, 3]}}, {a: {b: [4, 2]}});
      nomatch({"a.b": {$in: [1, 2, 3]}}, {a: {b: [4]}});

      // $or
      assert.throws(function () {
        match({$or: []}, {});
      });
      assert.throws(function () {
        match({$or: [5]}, {});
      });
      assert.throws(function () {
        match({$or: []}, {a: 1});
      });
      match({$or: [{a: 1}]}, {a: 1});
      nomatch({$or: [{b: 2}]}, {a: 1});
      match({$or: [{a: 1}, {b: 2}]}, {a: 1});
      nomatch({$or: [{c: 3}, {d: 4}]}, {a: 1});
      match({$or: [{a: 1}, {b: 2}]}, {a: [1, 2, 3]});
      nomatch({$or: [{a: 1}, {b: 2}]}, {c: [1, 2, 3]});
      nomatch({$or: [{a: 1}, {b: 2}]}, {a: [2, 3, 4]});
      match({$or: [{a: 1}, {a: 2}]}, {a: 1});
      match({$or: [{a: 1}, {a: 2}], b: 2}, {a: 1, b: 2});
      nomatch({$or: [{a: 2}, {a: 3}], b: 2}, {a: 1, b: 2});
      nomatch({$or: [{a: 1}, {a: 2}], b: 3}, {a: 1, b: 2});

      // Combining $or with equality
      match({x: 1, $or: [{a: 1}, {b: 1}]}, {x: 1, b: 1});
      match({$or: [{a: 1}, {b: 1}], x: 1}, {x: 1, b: 1});
      nomatch({x: 1, $or: [{a: 1}, {b: 1}]}, {b: 1});
      nomatch({x: 1, $or: [{a: 1}, {b: 1}]}, {x: 1});

      // $or and $lt, $lte, $gt, $gte
      match({$or: [{a: {$lte: 1}}, {a: 2}]}, {a: 1});
      nomatch({$or: [{a: {$lt: 1}}, {a: 2}]}, {a: 1});
      match({$or: [{a: {$gte: 1}}, {a: 2}]}, {a: 1});
      nomatch({$or: [{a: {$gt: 1}}, {a: 2}]}, {a: 1});
      match({$or: [{b: {$gt: 1}}, {b: {$lt: 3}}]}, {b: 2});
      nomatch({$or: [{b: {$lt: 1}}, {b: {$gt: 3}}]}, {b: 2});

      // $or and $in
      match({$or: [{a: {$in: [1, 2, 3]}}]}, {a: 1});
      nomatch({$or: [{a: {$in: [4, 5, 6]}}]}, {a: 1});
      match({$or: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {a: 1});
      match({$or: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {b: 2});
      nomatch({$or: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {c: 3});
      match({$or: [{a: {$in: [1, 2, 3]}}, {b: {$in: [1, 2, 3]}}]}, {b: 2});
      nomatch({$or: [{a: {$in: [1, 2, 3]}}, {b: {$in: [4, 5, 6]}}]}, {b: 2});

      // $or and $nin
      nomatch({$or: [{a: {$nin: [1, 2, 3]}}]}, {a: 1});
      match({$or: [{a: {$nin: [4, 5, 6]}}]}, {a: 1});
      nomatch({$or: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {a: 1});
      match({$or: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {b: 2});
      match({$or: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {c: 3});
      match({$or: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [1, 2, 3]}}]}, {b: 2});
      nomatch({$or: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [1, 2, 3]}}]}, {a: 1, b: 2});
      match({$or: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [4, 5, 6]}}]}, {b: 2});

      // $or and dot-notation
      match({$or: [{"a.b": 1}, {"a.b": 2}]}, {a: {b: 1}});
      match({$or: [{"a.b": 1}, {"a.c": 1}]}, {a: {b: 1}});
      nomatch({$or: [{"a.b": 2}, {"a.c": 1}]}, {a: {b: 1}});

      // $or and nested objects
      match({$or: [{a: {b: 1, c: 2}}, {a: {b: 2, c: 1}}]}, {a: {b: 1, c: 2}});
      nomatch({$or: [{a: {b: 1, c: 3}}, {a: {b: 2, c: 1}}]}, {a: {b: 1, c: 2}});

      // $or and regexes
      match({$or: [{a: /a/}]}, {a: "cat"});
      nomatch({$or: [{a: /o/}]}, {a: "cat"});
      match({$or: [{a: /a/}, {a: /o/}]}, {a: "cat"});
      nomatch({$or: [{a: /i/}, {a: /o/}]}, {a: "cat"});
      match({$or: [{a: /i/}, {b: /o/}]}, {a: "cat", b: "dog"});

      // $or and $ne
      match({$or: [{a: {$ne: 1}}]}, {});
      nomatch({$or: [{a: {$ne: 1}}]}, {a: 1});
      match({$or: [{a: {$ne: 1}}]}, {a: 2});
      match({$or: [{a: {$ne: 1}}]}, {b: 1});
      match({$or: [{a: {$ne: 1}}, {a: {$ne: 2}}]}, {a: 1});
      match({$or: [{a: {$ne: 1}}, {b: {$ne: 1}}]}, {a: 1});
      nomatch({$or: [{a: {$ne: 1}}, {b: {$ne: 2}}]}, {a: 1, b: 2});

      // $or and $not
      match({$or: [{a: {$not: {$mod: [10, 1]}}}]}, {});
      nomatch({$or: [{a: {$not: {$mod: [10, 1]}}}]}, {a: 1});
      match({$or: [{a: {$not: {$mod: [10, 1]}}}]}, {a: 2});
      match({$or: [{a: {$not: {$mod: [10, 1]}}}, {a: {$not: {$mod: [10, 2]}}}]}, {a: 1});
      nomatch({$or: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 1});
      match({$or: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 2});
      match({$or: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 3});
      // this is possibly an open-ended task, so we stop here ...

      // $nor
      assert.throws(function () {
        match({$nor: []}, {});
      });
      assert.throws(function () {
        match({$nor: [5]}, {});
      });
      assert.throws(function () {
        match({$nor: []}, {a: 1});
      });
      nomatch({$nor: [{a: 1}]}, {a: 1});
      match({$nor: [{b: 2}]}, {a: 1});
      nomatch({$nor: [{a: 1}, {b: 2}]}, {a: 1});
      match({$nor: [{c: 3}, {d: 4}]}, {a: 1});
      nomatch({$nor: [{a: 1}, {b: 2}]}, {a: [1, 2, 3]});
      match({$nor: [{a: 1}, {b: 2}]}, {c: [1, 2, 3]});
      match({$nor: [{a: 1}, {b: 2}]}, {a: [2, 3, 4]});
      nomatch({$nor: [{a: 1}, {a: 2}]}, {a: 1});

      // $nor and $lt, $lte, $gt, $gte
      nomatch({$nor: [{a: {$lte: 1}}, {a: 2}]}, {a: 1});
      match({$nor: [{a: {$lt: 1}}, {a: 2}]}, {a: 1});
      nomatch({$nor: [{a: {$gte: 1}}, {a: 2}]}, {a: 1});
      match({$nor: [{a: {$gt: 1}}, {a: 2}]}, {a: 1});
      nomatch({$nor: [{b: {$gt: 1}}, {b: {$lt: 3}}]}, {b: 2});
      match({$nor: [{b: {$lt: 1}}, {b: {$gt: 3}}]}, {b: 2});

      // $nor and $in
      nomatch({$nor: [{a: {$in: [1, 2, 3]}}]}, {a: 1});
      match({$nor: [{a: {$in: [4, 5, 6]}}]}, {a: 1});
      nomatch({$nor: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {a: 1});
      nomatch({$nor: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {b: 2});
      match({$nor: [{a: {$in: [1, 2, 3]}}, {b: 2}]}, {c: 3});
      nomatch({$nor: [{a: {$in: [1, 2, 3]}}, {b: {$in: [1, 2, 3]}}]}, {b: 2});
      match({$nor: [{a: {$in: [1, 2, 3]}}, {b: {$in: [4, 5, 6]}}]}, {b: 2});

      // $nor and $nin
      match({$nor: [{a: {$nin: [1, 2, 3]}}]}, {a: 1});
      nomatch({$nor: [{a: {$nin: [4, 5, 6]}}]}, {a: 1});
      match({$nor: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {a: 1});
      nomatch({$nor: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {b: 2});
      nomatch({$nor: [{a: {$nin: [1, 2, 3]}}, {b: 2}]}, {c: 3});
      nomatch({$nor: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [1, 2, 3]}}]}, {b: 2});
      match({$nor: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [1, 2, 3]}}]}, {a: 1, b: 2});
      nomatch({$nor: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [4, 5, 6]}}]}, {b: 2});

      // $nor and dot-notation
      nomatch({$nor: [{"a.b": 1}, {"a.b": 2}]}, {a: {b: 1}});
      nomatch({$nor: [{"a.b": 1}, {"a.c": 1}]}, {a: {b: 1}});
      match({$nor: [{"a.b": 2}, {"a.c": 1}]}, {a: {b: 1}});

      // $nor and nested objects
      nomatch({$nor: [{a: {b: 1, c: 2}}, {a: {b: 2, c: 1}}]}, {a: {b: 1, c: 2}});
      match({$nor: [{a: {b: 1, c: 3}}, {a: {b: 2, c: 1}}]}, {a: {b: 1, c: 2}});

      // $nor and regexes
      nomatch({$nor: [{a: /a/}]}, {a: "cat"});
      match({$nor: [{a: /o/}]}, {a: "cat"});
      nomatch({$nor: [{a: /a/}, {a: /o/}]}, {a: "cat"});
      match({$nor: [{a: /i/}, {a: /o/}]}, {a: "cat"});
      nomatch({$nor: [{a: /i/}, {b: /o/}]}, {a: "cat", b: "dog"});

      // $nor and $ne
      nomatch({$nor: [{a: {$ne: 1}}]}, {});
      match({$nor: [{a: {$ne: 1}}]}, {a: 1});
      nomatch({$nor: [{a: {$ne: 1}}]}, {a: 2});
      nomatch({$nor: [{a: {$ne: 1}}]}, {b: 1});
      nomatch({$nor: [{a: {$ne: 1}}, {a: {$ne: 2}}]}, {a: 1});
      nomatch({$nor: [{a: {$ne: 1}}, {b: {$ne: 1}}]}, {a: 1});
      match({$nor: [{a: {$ne: 1}}, {b: {$ne: 2}}]}, {a: 1, b: 2});

      // $nor and $not
      nomatch({$nor: [{a: {$not: {$mod: [10, 1]}}}]}, {});
      match({$nor: [{a: {$not: {$mod: [10, 1]}}}]}, {a: 1});
      nomatch({$nor: [{a: {$not: {$mod: [10, 1]}}}]}, {a: 2});
      nomatch({$nor: [{a: {$not: {$mod: [10, 1]}}}, {a: {$not: {$mod: [10, 2]}}}]}, {a: 1});
      match({$nor: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 1});
      nomatch({$nor: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 2});
      nomatch({$nor: [{a: {$not: {$mod: [10, 1]}}}, {a: {$mod: [10, 2]}}]}, {a: 3});

      // $and

      assert.throws(function () {
        match({$and: []}, {});
      });
      assert.throws(function () {
        match({$and: [5]}, {});
      });
      assert.throws(function () {
        match({$and: []}, {a: 1});
      });
      match({$and: [{a: 1}]}, {a: 1});
      nomatch({$and: [{a: 1}, {a: 2}]}, {a: 1});
      nomatch({$and: [{a: 1}, {b: 1}]}, {a: 1});
      match({$and: [{a: 1}, {b: 2}]}, {a: 1, b: 2});
      nomatch({$and: [{a: 1}, {b: 1}]}, {a: 1, b: 2});
      match({$and: [{a: 1}, {b: 2}], c: 3}, {a: 1, b: 2, c: 3});
      nomatch({$and: [{a: 1}, {b: 2}], c: 4}, {a: 1, b: 2, c: 3});

      // $and and regexes
      match({$and: [{a: /a/}]}, {a: "cat"});
      match({$and: [{a: /a/i}]}, {a: "CAT"});
      nomatch({$and: [{a: /o/}]}, {a: "cat"});
      nomatch({$and: [{a: /a/}, {a: /o/}]}, {a: "cat"});
      match({$and: [{a: /a/}, {b: /o/}]}, {a: "cat", b: "dog"});
      nomatch({$and: [{a: /a/}, {b: /a/}]}, {a: "cat", b: "dog"});

      // $and, dot-notation, and nested objects
      match({$and: [{"a.b": 1}]}, {a: {b: 1}});
      match({$and: [{a: {b: 1}}]}, {a: {b: 1}});
      nomatch({$and: [{"a.b": 2}]}, {a: {b: 1}});
      nomatch({$and: [{"a.c": 1}]}, {a: {b: 1}});
      nomatch({$and: [{"a.b": 1}, {"a.b": 2}]}, {a: {b: 1}});
      nomatch({$and: [{"a.b": 1}, {a: {b: 2}}]}, {a: {b: 1}});
      match({$and: [{"a.b": 1}, {"c.d": 2}]}, {a: {b: 1}, c: {d: 2}});
      nomatch({$and: [{"a.b": 1}, {"c.d": 1}]}, {a: {b: 1}, c: {d: 2}});
      match({$and: [{"a.b": 1}, {c: {d: 2}}]}, {a: {b: 1}, c: {d: 2}});
      nomatch({$and: [{"a.b": 1}, {c: {d: 1}}]}, {a: {b: 1}, c: {d: 2}});
      nomatch({$and: [{"a.b": 2}, {c: {d: 2}}]}, {a: {b: 1}, c: {d: 2}});
      match({$and: [{a: {b: 1}}, {c: {d: 2}}]}, {a: {b: 1}, c: {d: 2}});
      nomatch({$and: [{a: {b: 2}}, {c: {d: 2}}]}, {a: {b: 1}, c: {d: 2}});

      // $and and $in
      nomatch({$and: [{a: {$in: []}}]}, {});
      match({$and: [{a: {$in: [1, 2, 3]}}]}, {a: 1});
      nomatch({$and: [{a: {$in: [4, 5, 6]}}]}, {a: 1});
      nomatch({$and: [{a: {$in: [1, 2, 3]}}, {a: {$in: [4, 5, 6]}}]}, {a: 1});
      nomatch({$and: [{a: {$in: [1, 2, 3]}}, {b: {$in: [1, 2, 3]}}]}, {a: 1, b: 4});
      match({$and: [{a: {$in: [1, 2, 3]}}, {b: {$in: [4, 5, 6]}}]}, {a: 1, b: 4});


      // $and and $nin
      match({$and: [{a: {$nin: []}}]}, {});
      nomatch({$and: [{a: {$nin: [1, 2, 3]}}]}, {a: 1});
      match({$and: [{a: {$nin: [4, 5, 6]}}]}, {a: 1});
      nomatch({$and: [{a: {$nin: [1, 2, 3]}}, {a: {$nin: [4, 5, 6]}}]}, {a: 1});
      nomatch({$and: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [1, 2, 3]}}]}, {a: 1, b: 4});
      nomatch({$and: [{a: {$nin: [1, 2, 3]}}, {b: {$nin: [4, 5, 6]}}]}, {a: 1, b: 4});

      // $and and $lt, $lte, $gt, $gte
      match({$and: [{a: {$lt: 2}}]}, {a: 1});
      nomatch({$and: [{a: {$lt: 1}}]}, {a: 1});
      match({$and: [{a: {$lte: 1}}]}, {a: 1});
      match({$and: [{a: {$gt: 0}}]}, {a: 1});
      nomatch({$and: [{a: {$gt: 1}}]}, {a: 1});
      match({$and: [{a: {$gte: 1}}]}, {a: 1});
      match({$and: [{a: {$gt: 0}}, {a: {$lt: 2}}]}, {a: 1});
      nomatch({$and: [{a: {$gt: 1}}, {a: {$lt: 2}}]}, {a: 1});
      nomatch({$and: [{a: {$gt: 0}}, {a: {$lt: 1}}]}, {a: 1});
      match({$and: [{a: {$gte: 1}}, {a: {$lte: 1}}]}, {a: 1});
      nomatch({$and: [{a: {$gte: 2}}, {a: {$lte: 0}}]}, {a: 1});

      // $and and $ne
      match({$and: [{a: {$ne: 1}}]}, {});
      nomatch({$and: [{a: {$ne: 1}}]}, {a: 1});
      match({$and: [{a: {$ne: 1}}]}, {a: 2});
      nomatch({$and: [{a: {$ne: 1}}, {a: {$ne: 2}}]}, {a: 2});
      match({$and: [{a: {$ne: 1}}, {a: {$ne: 3}}]}, {a: 2});

      // $and and $not
      match({$and: [{a: {$not: {$gt: 2}}}]}, {a: 1});
      nomatch({$and: [{a: {$not: {$lt: 2}}}]}, {a: 1});
      match({$and: [{a: {$not: {$lt: 0}}}, {a: {$not: {$gt: 2}}}]}, {a: 1});
      nomatch({$and: [{a: {$not: {$lt: 2}}}, {a: {$not: {$gt: 0}}}]}, {a: 1});

      // $where
      match({$where: "this.a === 1"}, {a: 1});
      match({$where: "obj.a === 1"}, {a: 1});
      nomatch({$where: "this.a !== 1"}, {a: 1});
      nomatch({$where: "obj.a !== 1"}, {a: 1});
      nomatch({$where: "this.a === 1", a: 2}, {a: 1});
      match({$where: "this.a === 1", b: 2}, {a: 1, b: 2});
      match({$where: "this.a === 1 && this.b === 2"}, {a: 1, b: 2});
      match({$where: "this.a instanceof Array"}, {a: []});
      nomatch({$where: "this.a instanceof Array"}, {a: 1});

      // reaching into array
      match({"dogs.0.name": "Fido"}, {dogs: [{name: "Fido"}, {name: "Rex"}]});
      match({"dogs.1.name": "Rex"}, {dogs: [{name: "Fido"}, {name: "Rex"}]});
      nomatch({"dogs.1.name": "Fido"}, {dogs: [{name: "Fido"}, {name: "Rex"}]});
      match({"room.1b": "bla"}, {room: {"1b": "bla"}});

      match({"dogs.name": "Fido"}, {dogs: [{name: "Fido"}, {name: "Rex"}]});
      match({"dogs.name": "Rex"}, {dogs: [{name: "Fido"}, {name: "Rex"}]});
      match({"animals.dogs.name": "Fido"},
            {animals: [{dogs: [{name: "Rover"}]},
                       {},
                       {dogs: [{name: "Fido"}, {name: "Rex"}]}]});
      match({"animals.dogs.name": "Fido"},
            {animals: [{dogs: {name: "Rex"}},
                       {dogs: {name: "Fido"}}]});
      match({"animals.dogs.name": "Fido"},
            {animals: [{dogs: [{name: "Rover"}]},
                       {},
                       {dogs: [{name: ["Fido"]}, {name: "Rex"}]}]});
      nomatch({"dogs.name": "Fido"}, {dogs: []});

      // $elemMatch
      match({dogs: {$elemMatch: {name: /e/}}},
            {dogs: [{name: "Fido"}, {name: "Rex"}]});
      nomatch({dogs: {$elemMatch: {name: /a/}}},
              {dogs: [{name: "Fido"}, {name: "Rex"}]});
      match({dogs: {$elemMatch: {age: {$gt: 4}}}},
            {dogs: [{name: "Fido", age: 5}, {name: "Rex", age: 3}]});
      match({dogs: {$elemMatch: {name: "Fido", age: {$gt: 4}}}},
            {dogs: [{name: "Fido", age: 5}, {name: "Rex", age: 3}]});
      nomatch({dogs: {$elemMatch: {name: "Fido", age: {$gt: 5}}}},
              {dogs: [{name: "Fido", age: 5}, {name: "Rex", age: 3}]});
      match({dogs: {$elemMatch: {name: /i/, age: {$gt: 4}}}},
            {dogs: [{name: "Fido", age: 5}, {name: "Rex", age: 3}]});
      nomatch({dogs: {$elemMatch: {name: /e/, age: 5}}},
              {dogs: [{name: "Fido", age: 5}, {name: "Rex", age: 3}]});
      match({x: {$elemMatch: {y: 9}}}, {x: [{y: 9}]});
      nomatch({x: {$elemMatch: {y: 9}}}, {x: [[{y: 9}]]});
      match({x: {$elemMatch: {$gt: 5, $lt: 9}}}, {x: [8]});
      nomatch({x: {$elemMatch: {$gt: 5, $lt: 9}}}, {x: [[8]]});
      match({'a.x': {$elemMatch: {y: 9}}},
            {a: [{x: []}, {x: [{y: 9}]}]});
      nomatch({a: {$elemMatch: {x: 5}}}, {a: {x: 5}});
      match({a: {$elemMatch: {0: {$gt: 5, $lt: 9}}}}, {a: [[6]]});
      match({a: {$elemMatch: {'0.b': {$gt: 5, $lt: 9}}}}, {a: [[{b:6}]]});
      match({a: {$elemMatch: {x: 1, $or: [{a: 1}, {b: 1}]}}},
            {a: [{x: 1, b: 1}]});
      match({a: {$elemMatch: {$or: [{a: 1}, {b: 1}], x: 1}}},
            {a: [{x: 1, b: 1}]});
      nomatch({a: {$elemMatch: {x: 1, $or: [{a: 1}, {b: 1}]}}},
              {a: [{b: 1}]});
      nomatch({a: {$elemMatch: {x: 1, $or: [{a: 1}, {b: 1}]}}},
              {a: [{x: 1}]});
      nomatch({a: {$elemMatch: {x: 1, $or: [{a: 1}, {b: 1}]}}},
              {a: [{x: 1}, {b: 1}]});

      // $comment
      match({a: 5, $comment: "asdf"}, {a: 5});
      nomatch({a: 6, $comment: "asdf"}, {a: 5});

      // XXX still needs tests:
      // - non-scalar arguments to $gt, $lt, etc
    });
});
