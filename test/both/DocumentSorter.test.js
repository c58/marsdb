import EJSON from '../../lib/EJSON';
import DocumentMatcher, {makeLookupFunction} from '../../lib/DocumentMatcher';
import DocumentSorter from '../../lib/DocumentSorter';
import {MongoTypeComp} from '../../lib/Document';
import chai, {except, assert} from 'chai';
import _ from 'lodash';
chai.use(require('chai-as-promised'));
chai.should();

var assert_ordering = function (f, values) {
  for (var i = 0; i < values.length; i++) {
    var x = f(values[i], values[i]);
    if (x !== 0) {
      // XXX super janky
      assert.fail(
        JSON.stringify(values[i]),
        JSON.stringify(x),
        "value doesn't order as equal to itself"
      );
    }
    if (i + 1 < values.length) {
      var less = values[i];
      var more = values[i + 1];
      var x = f(less, more);
      if (!(x < 0)) {
        // XXX super janky
        assert.fail(
          [JSON.stringify(less), JSON.stringify(more)],
          JSON.stringify(x),
          "ordering test failed"
        )
      }
      x = f(more, less);
      if (!(x > 0)) {
        // XXX super janky
        assert.fail(
          [JSON.stringify(less), JSON.stringify(more)],
          JSON.stringify(x),
          "ordering test failed"
        )
      }
    }
  }
};


describe('DocumentSorter', () => {
  it('should corerctly sort respect to BSON ordering', function () {
    var shortBinary = EJSON.newBinary(1);
    shortBinary[0] = 128;
    var longBinary1 = EJSON.newBinary(2);
    longBinary1[1] = 42;
    var longBinary2 = EJSON.newBinary(2);
    longBinary2[1] = 50;

    var date1 = new Date;
    var date2 = new Date(date1.getTime() + 1000);

    // value ordering
    assert_ordering(MongoTypeComp._cmp, [
      null,
      1, 2.2, 3,
      "03", "1", "11", "2", "a", "aaa",
      {}, {a: 2}, {a: 3}, {a: 3, b: 4}, {b: 4}, {b: 4, a: 3},
      {b: {}}, {b: [1, 2, 3]}, {b: [1, 2, 4]},
      [], [1, 2], [1, 2, 3], [1, 2, 4], [1, 2, "4"], [1, 2, [4]],
      shortBinary, longBinary1, longBinary2,
      false, true,
      date1, date2
    ]);
  });

  describe('Basic sotring', function () {
    // document ordering under a sort specification
    var verify = function (sorts, docs) {
      it(`should correctly sort ${JSON.stringify(sorts)}
          to be equals to ${JSON.stringify(docs)}`, function() {
        _.each(_.isArray(sorts) ? sorts : [sorts], function (sort) {
          var sorter = new DocumentSorter(sort);
          assert_ordering(sorter.getComparator(), docs);
        });
      });
    };

    // note: [] doesn't sort with "arrays", it sorts as "undefined". the position
    // of arrays in _typeorder only matters for things like $lt. (This behavior
    // verified with MongoDB 2.2.1.) We don't define the relative order of {a: []}
    // and {c: 1} is undefined (MongoDB does seem to care but it's not clear how
    // or why).
    verify([{"a" : 1}, ["a"], [["a", "asc"]]],
           [{a: []}, {a: 1}, {a: {}}, {a: true}]);
    verify([{"a" : 1}, ["a"], [["a", "asc"]]],
           [{c: 1}, {a: 1}, {a: {}}, {a: true}]);
    verify([{"a" : -1}, [["a", "desc"]]],
           [{a: true}, {a: {}}, {a: 1}, {c: 1}]);
    verify([{"a" : -1}, [["a", "desc"]]],
           [{a: true}, {a: {}}, {a: 1}, {a: []}]);

    verify([{"a" : 1, "b": -1}, ["a", ["b", "desc"]],
            [["a", "asc"], ["b", "desc"]]],
           [{c: 1}, {a: 1, b: 3}, {a: 1, b: 2}, {a: 2, b: 0}]);

    verify([{"a" : 1, "b": 1}, ["a", "b"],
            [["a", "asc"], ["b", "asc"]]],
           [{c: 1}, {a: 1, b: 2}, {a: 1, b: 3}, {a: 2, b: 0}]);

    assert.throws(function () {
      new DocumentSorter("a");
    });

    assert.throws(function () {
      new DocumentSorter(123);
    });

    // We don't support $natural:1 (since we don't actually have Mongo's on-disk
    // ordering available!)
    assert.throws(function () {
      new DocumentSorter({$natural: 1});
    });

    // No sort spec implies everything equal.
    assert.deepEqual(new DocumentSorter({}).getComparator()({a:1}, {a:2}), 0);

    // All sorts of array edge cases!
    // Increasing sort sorts by the smallest element it finds; 1 < 2.
    verify({a: 1}, [
      {a: [1, 10, 20]},
      {a: [5, 2, 99]}
    ]);
    // Decreasing sorts by largest it finds; 99 > 20.
    verify({a: -1}, [
      {a: [5, 2, 99]},
      {a: [1, 10, 20]}
    ]);
    // Can also sort by specific array indices.
    verify({'a.1': 1}, [
      {a: [5, 2, 99]},
      {a: [1, 10, 20]}
    ]);
    // We do NOT expand sub-arrays, so the minimum in the second doc is 5, not
    // -20. (Numbers always sort before arrays.)
    verify({a: 1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [-5, -20], 18]}
    ]);
    // The maximum in each of these is the array, since arrays are "greater" than
    // numbers. And [10, 15] is greater than [-5, -20].
    verify({a: -1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [-5, -20], 18]}
    ]);
    // 'a.0' here ONLY means "first element of a", not "first element of something
    // found in a", so it CANNOT find the 10 or -5.
    verify({'a.0': 1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [-5, -20], 18]}
    ]);
    verify({'a.0': -1}, [
      {a: [5, [-5, -20], 18]},
      {a: [1, [10, 15], 20]}
    ]);
    // Similarly, this is just comparing [-5,-20] to [10, 15].
    verify({'a.1': 1}, [
      {a: [5, [-5, -20], 18]},
      {a: [1, [10, 15], 20]}
    ]);
    verify({'a.1': -1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [-5, -20], 18]}
    ]);
    // Here we are just comparing [10,15] directly to [19,3] (and NOT also
    // iterating over the numbers; this is implemented by setting dontIterate in
    // makeLookupFunction).  So [10,15]<[19,3] even though 3 is the smallest
    // number you can find there.
    verify({'a.1': 1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [19, 3], 18]}
    ]);
    verify({'a.1': -1}, [
      {a: [5, [19, 3], 18]},
      {a: [1, [10, 15], 20]}
    ]);
    // Minimal elements are 1 and 5.
    verify({a: 1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [19, 3], 18]}
    ]);
    // Maximal elements are [19,3] and [10,15] (because arrays sort higher than
    // numbers), even though there's a 20 floating around.
    verify({a: -1}, [
      {a: [5, [19, 3], 18]},
      {a: [1, [10, 15], 20]}
    ]);
    // Maximal elements are [10,15] and [3,19].  [10,15] is bigger even though 19
    // is the biggest number in them, because array comparison is lexicographic.
    verify({a: -1}, [
      {a: [1, [10, 15], 20]},
      {a: [5, [3, 19], 18]}
    ]);

    // (0,4) < (0,5), so they go in this order.  It's not correct to consider
    // (0,3) as a sort key for the second document because they come from
    // different a-branches.
    verify({'a.x': 1, 'a.y': 1}, [
      {a: [{x: 0, y: 4}]},
      {a: [{x: 0, y: 5}, {x: 1, y: 3}]}
    ]);

    verify({'a.0.s': 1}, [
      {a: [ {s: 1} ]},
      {a: [ {s: 2} ]}
    ]);
  });

  describe("Sort keys", function () {
    var keyListToObject = function (keyList) {
      var obj = {};
      _.each(keyList, function (key) {
        obj[EJSON.stringify(key)] = true;
      });
      return obj;
    };

    var testKeys = function (sortSpec, doc, expectedKeyList) {
      it(`should corerctly process sort spec ${JSON.stringify(sortSpec)}
          with doc ${JSON.stringify(doc)}`, function () {
        var expectedKeys = keyListToObject(expectedKeyList);
        var sorter = new DocumentSorter(sortSpec);

        var actualKeyList = [];
        sorter._generateKeysFromDoc(doc, function (key) {
          actualKeyList.push(key);
        });
        var actualKeys = keyListToObject(actualKeyList);
        assert.deepEqual(actualKeys, expectedKeys);
      });
    };

    var testParallelError = function (sortSpec, doc) {
      it(`should throw an error on parallel arrays with spec ${JSON.stringify(sortSpec)}`, function () {
        var sorter = new DocumentSorter(sortSpec);
        assert.throws(function () {
          sorter._generateKeysFromDoc(doc, function (){});
        }, /parallel arrays/);
      });
    };

    // Just non-array fields.
    testKeys({'a.x': 1, 'a.y': 1},
             {a: {x: 0, y: 5}},
             [[0,5]]);

    // Ensure that we don't get [0,3] and [1,5].
    testKeys({'a.x': 1, 'a.y': 1},
             {a: [{x: 0, y: 5}, {x: 1, y: 3}]},
             [[0,5], [1,3]]);

    // Ensure we can combine "array fields" with "non-array fields".
    testKeys({'a.x': 1, 'a.y': 1, b: -1},
             {a: [{x: 0, y: 5}, {x: 1, y: 3}], b: 42},
             [[0,5,42], [1,3,42]]);
    testKeys({b: -1, 'a.x': 1, 'a.y': 1},
             {a: [{x: 0, y: 5}, {x: 1, y: 3}], b: 42},
             [[42,0,5], [42,1,3]]);
    testKeys({'a.x': 1, b: -1, 'a.y': 1},
             {a: [{x: 0, y: 5}, {x: 1, y: 3}], b: 42},
             [[0,42,5], [1,42,3]]);
    testKeys({a: 1, b: 1},
             {a: [1, 2, 3], b: 42},
             [[1,42], [2,42], [3,42]]);

    // Don't support multiple arrays at the same level.
    testParallelError({a: 1, b: 1},
                      {a: [1, 2, 3], b: [42]});

    // We are MORE STRICT than Mongo here; Mongo supports this!
    // XXX support this too  #NestedArraySort
    testParallelError({'a.x': 1, 'a.y': 1},
                      {a: [{x: 1, y: [2, 3]},
                           {x: 2, y: [4, 5]}]});
  });

  describe("Sort key filter", function () {
    var testOrder = function (sortSpec, selector, doc1, doc2) {
      it(`should correctly order docs ${JSON.stringify(doc1)}
        and ${JSON.stringify(doc2)} with spec ${JSON.stringify(sortSpec)}
        and selector ${JSON.stringify(selector)}`, function () {
        var matcher = new DocumentMatcher(selector);
        var sorter = new DocumentSorter(sortSpec, {matcher: matcher});
        var comparator = sorter.getComparator();
        var comparison = comparator(doc1, doc2);
        assert.isTrue(comparison < 0);
      });
    };

    testOrder({'a.x': 1}, {'a.x': {$gt: 1}},
              {a: {x: 3}},
              {a: {x: [1, 4]}});
    testOrder({'a.x': 1}, {'a.x': {$gt: 0}},
              {a: {x: [1, 4]}},
              {a: {x: 3}});

    var keyCompatible = function (sortSpec, selector, key, compatible) {
      it(`should ${compatible ? 'to be compatible' : 'NOT be compatible'} with spec ${JSON.stringify(sortSpec)},
          selector ${JSON.stringify(selector)} and key ${JSON.stringify(key)}`, function () {
        var matcher = new DocumentMatcher(selector);
        var sorter = new DocumentSorter(sortSpec, {matcher: matcher});
        var actual = sorter._keyCompatibleWithSelector(key);
        assert.deepEqual(actual, compatible);
      });
    };

    keyCompatible({a: 1}, {a: 5}, [5], true);
    keyCompatible({a: 1}, {a: 5}, [8], false);
    keyCompatible({a: 1}, {a: {x: 5}}, [{x: 5}], true);
    keyCompatible({a: 1}, {a: {x: 5}}, [{x: 5, y: 9}], false);
    keyCompatible({'a.x': 1}, {a: {x: 5}}, [5], true);
    // To confirm this:
    //   > db.x.insert({_id: "q", a: [{x:1}, {x:5}], b: 2})
    //   > db.x.insert({_id: "w", a: [{x:5}, {x:10}], b: 1})
    //   > db.x.find({}).sort({'a.x': 1, b: 1})
    //   { "_id" : "q", "a" : [  {  "x" : 1 },  {  "x" : 5 } ], "b" : 2 }
    //   { "_id" : "w", "a" : [  {  "x" : 5 },  {  "x" : 10 } ], "b" : 1 }
    //   > db.x.find({a: {x:5}}).sort({'a.x': 1, b: 1})
    //   { "_id" : "q", "a" : [  {  "x" : 1 },  {  "x" : 5 } ], "b" : 2 }
    //   { "_id" : "w", "a" : [  {  "x" : 5 },  {  "x" : 10 } ], "b" : 1 }
    //   > db.x.find({'a.x': 5}).sort({'a.x': 1, b: 1})
    //   { "_id" : "w", "a" : [  {  "x" : 5 },  {  "x" : 10 } ], "b" : 1 }
    //   { "_id" : "q", "a" : [  {  "x" : 1 },  {  "x" : 5 } ], "b" : 2 }
    // ie, only the last one manages to trigger the key compatibility code,
    // not the previous one.  (The "b" sort is necessary because when the key
    // compatibility code *does* kick in, both documents only end up with "5"
    // for the first field as their only sort key, and we need to differentiate
    // somehow...)
    keyCompatible({'a.x': 1}, {a: {x: 5}}, [1], true);
    keyCompatible({'a.x': 1}, {'a.x': 5}, [5], true);
    keyCompatible({'a.x': 1}, {'a.x': 5}, [1], false);

    // Regex key check.
    keyCompatible({a: 1}, {a: /^foo+/}, ['foo'], true);
    keyCompatible({a: 1}, {a: /^foo+/}, ['foooo'], true);
    keyCompatible({a: 1}, {a: /^foo+/}, ['foooobar'], true);
    keyCompatible({a: 1}, {a: /^foo+/}, ['afoooo'], false);
    keyCompatible({a: 1}, {a: /^foo+/}, [''], false);
    keyCompatible({a: 1}, {a: {$regex: "^foo+"}}, ['foo'], true);
    keyCompatible({a: 1}, {a: {$regex: "^foo+"}}, ['foooo'], true);
    keyCompatible({a: 1}, {a: {$regex: "^foo+"}}, ['foooobar'], true);
    keyCompatible({a: 1}, {a: {$regex: "^foo+"}}, ['afoooo'], false);
    keyCompatible({a: 1}, {a: {$regex: "^foo+"}}, [''], false);

    keyCompatible({a: 1}, {a: /^foo+/i}, ['foo'], true);
    // Key compatibility check appears to be turned off for regexps with flags.
    keyCompatible({a: 1}, {a: /^foo+/i}, ['bar'], true);
    keyCompatible({a: 1}, {a: /^foo+/m}, ['bar'], true);
    keyCompatible({a: 1}, {a: {$regex: "^foo+", $options: "i"}}, ['bar'], true);
    keyCompatible({a: 1}, {a: {$regex: "^foo+", $options: "m"}}, ['bar'], true);

    // Multiple keys!
    keyCompatible({a: 1, b: 1, c: 1},
                  {a: {$gt: 5}, c: {$lt: 3}}, [6, "bla", 2], true);
    keyCompatible({a: 1, b: 1, c: 1},
                  {a: {$gt: 5}, c: {$lt: 3}}, [6, "bla", 4], false);
    keyCompatible({a: 1, b: 1, c: 1},
                  {a: {$gt: 5}, c: {$lt: 3}}, [3, "bla", 1], false);
    // No filtering is done (ie, all keys are compatible) if the first key isn't
    // constrained.
    keyCompatible({a: 1, b: 1, c: 1},
                  {c: {$lt: 3}}, [3, "bla", 4], true);
  });
});