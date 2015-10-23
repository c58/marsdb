import DocumentMatcher from '../../lib/DocumentMatcher';
import EJSON from '../../lib/EJSON';
import Collection from '../../lib/Collection';
import chai, {expect, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


describe('DocumentModifier', function () {
  var modifyWithQuery = function (doc, query, mod, expected) {
    it(`should update ${JSON.stringify(doc)} with query ${JSON.stringify(query)}
        by mod ${JSON.stringify(mod)}`, function() {
      var coll = new Collection('test');
      return coll.insert(doc).then((id) => {
        return coll.update(query, mod);
      }).then(() => {
        return coll.findOne();
      }).then((actual) => {
        delete actual._id;  // added by insert
        assert.deepEqual(actual, expected)
      });
    });
  };
  var modify = function (doc, mod, expected) {
    modifyWithQuery(doc, {}, mod, expected);
  };
  var exceptionWithQuery = function (doc, query, mod) {
    it(`should raise an exception while updating ${JSON.stringify(doc)}
        with query ${JSON.stringify(query)} by mod ${JSON.stringify(mod)}`, function() {
      var coll = new Collection('test');
      return coll.insert(doc).then(() => {
        return coll.update(query, mod).should.eventually.rejectedWith(Error);
      })
    });
  };
  var exception = function (doc, mod) {
    exceptionWithQuery(doc, {}, mod);
  };

  // document replacement
  modify({}, {}, {});
  modify({a: 12}, {}, {}); // tested against mongodb
  modify({a: 12}, {a: 13}, {a:13});
  modify({a: 12, b: 99}, {a: 13}, {a:13});
  exception({a: 12}, {a: 13, $set: {b: 13}});
  exception({a: 12}, {$set: {b: 13}, a: 13});

  // keys
  modify({}, {$set: {'a': 12}}, {a: 12});
  modify({}, {$set: {'a.b': 12}}, {a: {b: 12}});
  modify({}, {$set: {'a.b.c': 12}}, {a: {b: {c: 12}}});
  modify({a: {d: 99}}, {$set: {'a.b.c': 12}}, {a: {d: 99, b: {c: 12}}});
  modify({}, {$set: {'a.b.3.c': 12}}, {a: {b: {3: {c: 12}}}});
  modify({a: {b: []}}, {$set: {'a.b.3.c': 12}}, {
    a: {b: [null, null, null, {c: 12}]}});
  exception({a: [null, null, null]}, {$set: {'a.1.b': 12}});
  exception({a: [null, 1, null]}, {$set: {'a.1.b': 12}});
  exception({a: [null, "x", null]}, {$set: {'a.1.b': 12}});
  exception({a: [null, [], null]}, {$set: {'a.1.b': 12}});
  modify({a: [null, null, null]}, {$set: {'a.3.b': 12}}, {
    a: [null, null, null, {b: 12}]});
  exception({a: []}, {$set: {'a.b': 12}});
  exception({a: 12}, {$set: {'a.b': 99}}); // tested on mongo
  exception({a: 'x'}, {$set: {'a.b': 99}});
  exception({a: true}, {$set: {'a.b': 99}});
  exception({a: null}, {$set: {'a.b': 99}});
  modify({a: {}}, {$set: {'a.3': 12}}, {a: {'3': 12}});
  modify({a: []}, {$set: {'a.3': 12}}, {a: [null, null, null, 12]});
  exception({}, {$set: {'': 12}}); // tested on mongo
  exception({}, {$set: {'.': 12}}); // tested on mongo
  exception({}, {$set: {'a.': 12}}); // tested on mongo
  exception({}, {$set: {'. ': 12}}); // tested on mongo
  exception({}, {$inc: {'... ': 12}}); // tested on mongo
  exception({}, {$set: {'a..b': 12}}); // tested on mongo
  modify({a: [1,2,3]}, {$set: {'a.01': 99}}, {a: [1, 99, 3]});
  modify({a: [1,{a: 98},3]}, {$set: {'a.01.b': 99}}, {a: [1,{a:98, b: 99},3]});
  modify({}, {$set: {'2.a.b': 12}}, {'2': {'a': {'b': 12}}}); // tested
  exception({x: []}, {$set: {'x.2..a': 99}});
  modify({x: [null, null]}, {$set: {'x.2.a': 1}}, {x: [null, null, {a: 1}]});
  exception({x: [null, null]}, {$set: {'x.1.a': 1}});

  // a.$.b
  modifyWithQuery({a: [{x: 2}, {x: 4}]}, {'a.x': 4}, {$set: {'a.$.z': 9}},
                  {a: [{x: 2}, {x: 4, z: 9}]});
  exception({a: [{x: 2}, {x: 4}]}, {$set: {'a.$.z': 9}});
  exceptionWithQuery({a: [{x: 2}, {x: 4}], b: 5}, {b: 5}, {$set: {'a.$.z': 9}});
  // can't have two $
  exceptionWithQuery({a: [{x: [2]}]}, {'a.x': 2}, {$set: {'a.$.x.$': 9}});
  modifyWithQuery({a: [5, 6, 7]}, {a: 6}, {$set: {'a.$': 9}}, {a: [5, 9, 7]});
  modifyWithQuery({a: [{b: [{c: 9}, {c: 10}]}, {b: {c: 11}}]}, {'a.b.c': 10},
                  {$unset: {'a.$.b': 1}}, {a: [{}, {b: {c: 11}}]});
  modifyWithQuery({a: [{b: [{c: 9}, {c: 10}]}, {b: {c: 11}}]}, {'a.b.c': 11},
                  {$unset: {'a.$.b': 1}},
                  {a: [{b: [{c: 9}, {c: 10}]}, {}]});
  modifyWithQuery({a: [1]}, {'a.0': 1}, {$set: {'a.$': 5}}, {a: [5]});
  modifyWithQuery({a: [9]}, {a: {$mod: [2, 1]}}, {$set: {'a.$': 5}}, {a: [5]});
  // Negatives don't set '$'.
  exceptionWithQuery({a: [1]}, {a: {$ne: 2}}, {$set: {'a.$': 5}});
  exceptionWithQuery({a: [1]}, {'a.0': {$ne: 2}}, {$set: {'a.$': 5}});
  // One $or clause works.
  modifyWithQuery({a: [{x: 2}, {x: 4}]},
                  {$or: [{'a.x': 4}]}, {$set: {'a.$.z': 9}},
                  {a: [{x: 2}, {x: 4, z: 9}]});
  // More $or clauses throw.
  exceptionWithQuery({a: [{x: 2}, {x: 4}]},
                     {$or: [{'a.x': 4}, {'a.x': 4}]},
                     {$set: {'a.$.z': 9}});
  // $and uses the last one.
  modifyWithQuery({a: [{x: 1}, {x: 3}]},
                  {$and: [{'a.x': 1}, {'a.x': 3}]},
                  {$set: {'a.$.x': 5}},
                  {a: [{x: 1}, {x: 5}]});
  modifyWithQuery({a: [{x: 1}, {x: 3}]},
                  {$and: [{'a.x': 3}, {'a.x': 1}]},
                  {$set: {'a.$.x': 5}},
                  {a: [{x: 5}, {x: 3}]});
  // Same goes for the implicit AND of a document selector.
  modifyWithQuery({a: [{x: 1}, {y: 3}]},
                  {'a.x': 1, 'a.y': 3},
                  {$set: {'a.$.z': 5}},
                  {a: [{x: 1}, {y: 3, z: 5}]});
  // with $near, make sure it finds the closest one
  modifyWithQuery({a: [{b: [1,1]},
                       {b: [ [3,3], [4,4] ]},
                       {b: [9,9]}]},
                  {'a.b': {$near: [5, 5]}},
                  {$set: {'a.$.b': 'k'}},
                  {a: [{b: [1,1]}, {b: 'k'}, {b: [9,9]}]});
  modifyWithQuery({a: [{x: 1}, {y: 1}, {x: 1, y: 1}]},
                  {a: {$elemMatch: {x: 1, y: 1}}},
                  {$set: {'a.$.x': 2}},
                  {a: [{x: 1}, {y: 1}, {x: 2, y: 1}]});
  modifyWithQuery({a: [{b: [{x: 1}, {y: 1}, {x: 1, y: 1}]}]},
                  {'a.b': {$elemMatch: {x: 1, y: 1}}},
                  {$set: {'a.$.b': 3}},
                  {a: [{b: 3}]});

  // $inc
  modify({a: 1, b: 2}, {$inc: {a: 10}}, {a: 11, b: 2});
  modify({a: 1, b: 2}, {$inc: {c: 10}}, {a: 1, b: 2, c: 10});
  exception({a: 1}, {$inc: {a: '10'}});
  exception({a: 1}, {$inc: {a: true}});
  exception({a: 1}, {$inc: {a: [10]}});
  exception({a: '1'}, {$inc: {a: 10}});
  exception({a: [1]}, {$inc: {a: 10}});
  exception({a: {}}, {$inc: {a: 10}});
  exception({a: false}, {$inc: {a: 10}});
  exception({a: null}, {$inc: {a: 10}});
  modify({a: [1, 2]}, {$inc: {'a.1': 10}}, {a: [1, 12]});
  modify({a: [1, 2]}, {$inc: {'a.2': 10}}, {a: [1, 2, 10]});
  modify({a: [1, 2]}, {$inc: {'a.3': 10}}, {a: [1, 2, null, 10]});
  modify({a: {b: 2}}, {$inc: {'a.b': 10}}, {a: {b: 12}});
  modify({a: {b: 2}}, {$inc: {'a.c': 10}}, {a: {b: 2, c: 10}});
  exception({}, {$inc: {_id: 1}});

  // $set
  modify({a: 1, b: 2}, {$set: {a: 10}}, {a: 10, b: 2});
  modify({a: 1, b: 2}, {$set: {c: 10}}, {a: 1, b: 2, c: 10});
  modify({a: 1, b: 2}, {$set: {a: {c: 10}}}, {a: {c: 10}, b: 2});
  modify({a: [1, 2], b: 2}, {$set: {a: [3, 4]}}, {a: [3, 4], b: 2});
  modify({a: [1, 2, 3], b: 2}, {$set: {'a.1': [3, 4]}},
         {a: [1, [3, 4], 3], b:2});
  modify({a: [1], b: 2}, {$set: {'a.1': 9}}, {a: [1, 9], b: 2});
  modify({a: [1], b: 2}, {$set: {'a.2': 9}}, {a: [1, null, 9], b: 2});
  modify({a: {b: 1}}, {$set: {'a.c': 9}}, {a: {b: 1, c: 9}});
  modify({}, {$set: {'x._id': 4}}, {x: {_id: 4}});
  exception({}, {$set: {_id: 4}});
  exception({_id: 4}, {$set: {_id: 4}});  // even not-changing _id is bad

  // $unset
  modify({}, {$unset: {a: 1}}, {});
  modify({a: 1}, {$unset: {a: 1}}, {});
  modify({a: 1, b: 2}, {$unset: {a: 1}}, {b: 2});
  modify({a: 1, b: 2}, {$unset: {a: 0}}, {b: 2});
  modify({a: 1, b: 2}, {$unset: {a: false}}, {b: 2});
  modify({a: 1, b: 2}, {$unset: {a: null}}, {b: 2});
  modify({a: 1, b: 2}, {$unset: {a: [1]}}, {b: 2});
  modify({a: 1, b: 2}, {$unset: {a: {}}}, {b: 2});
  modify({a: {b: 2, c: 3}}, {$unset: {'a.b': 1}}, {a: {c: 3}});
  modify({a: [1, 2, 3]}, {$unset: {'a.1': 1}}, {a: [1, null, 3]}); // tested
  modify({a: [1, 2, 3]}, {$unset: {'a.2': 1}}, {a: [1, 2, null]}); // tested
  modify({a: [1, 2, 3]}, {$unset: {'a.x': 1}}, {a: [1, 2, 3]}); // tested
  modify({a: {b: 1}}, {$unset: {'a.b.c.d': 1}}, {a: {b: 1}});
  modify({a: {b: 1}}, {$unset: {'a.x.c.d': 1}}, {a: {b: 1}});
  modify({a: {b: {c: 1}}}, {$unset: {'a.b.c': 1}}, {a: {b: {}}});
  exception({}, {$unset: {_id: 1}});

  // $push
  modify({}, {$push: {a: 1}}, {a: [1]});
  modify({a: []}, {$push: {a: 1}}, {a: [1]});
  modify({a: [1]}, {$push: {a: 2}}, {a: [1, 2]});
  exception({a: true}, {$push: {a: 1}});
  modify({a: [1]}, {$push: {a: [2]}}, {a: [1, [2]]});
  modify({a: []}, {$push: {'a.1': 99}}, {a: [null, [99]]}); // tested
  modify({a: {}}, {$push: {'a.x': 99}}, {a: {x: [99]}});
  modify({}, {$push: {a: {$each: [1, 2, 3]}}},
         {a: [1, 2, 3]});
  modify({a: []}, {$push: {a: {$each: [1, 2, 3]}}},
         {a: [1, 2, 3]});
  modify({a: [true]}, {$push: {a: {$each: [1, 2, 3]}}},
         {a: [true, 1, 2, 3]});
  // No positive numbers for $slice
  exception({}, {$push: {a: {$each: [], $slice: 5}}});
  modify({a: [true]}, {$push: {a: {$each: [1, 2, 3], $slice: -2}}},
         {a: [2, 3]});
  modify({a: [false, true]}, {$push: {a: {$each: [1], $slice: -2}}},
         {a: [true, 1]});
  modify(
    {a: [{x: 3}, {x: 1}]},
    {$push: {a: {
      $each: [{x: 4}, {x: 2}],
      $slice: -2,
      $sort: {x: 1}
    }}},
    {a: [{x: 3}, {x: 4}]});
  modify({}, {$push: {a: {$each: [1, 2, 3], $slice: 0}}}, {a: []});
  modify({a: [1, 2]}, {$push: {a: {$each: [1, 2, 3], $slice: 0}}}, {a: []});
  // $push with $position modifier
  // No negative number for $position
  exception({a: []}, {$push: {a: {$each: [0], $position: -1}}});
  modify({a: [1, 2]}, {$push: {a: {$each: [0], $position: 0}}},
    {a: [0, 1, 2]});
  modify({a: [1, 2]}, {$push: {a: {$each: [-1, 0], $position: 0}}},
    {a: [-1, 0, 1, 2]});
  modify({a: [1, 3]}, {$push: {a: {$each: [2], $position: 1}}}, {a: [1, 2, 3]});
  modify({a: [1, 4]}, {$push: {a: {$each: [2, 3], $position: 1}}},
    {a: [1, 2, 3, 4]});
  modify({a: [1, 2]}, {$push: {a: {$each: [3], $position: 3}}}, {a: [1, 2, 3]});
  modify({a: [1, 2]}, {$push: {a: {$each: [3], $position: 99}}},
    {a: [1, 2, 3]});
  modify({a: [1, 2]}, {$push: {a: {$each: [3], $position: 99, $slice: -2}}},
    {a: [2, 3]});
  modify(
    {a: [{x: 1}, {x: 2}]},
    {$push: {a: {$each: [{x: 3}], $position: 0, $sort: {x: 1}, $slice: -3}}},
    {a: [{x: 1}, {x: 2}, {x: 3}]}
  );
  modify(
    {a: [{x: 1}, {x: 2}]},
    {$push: {a: {$each: [{x: 3}], $position: 0, $sort: {x: 1}, $slice: 0}}},
    {a: []}
  );


  // $pushAll
  modify({}, {$pushAll: {a: [1]}}, {a: [1]});
  modify({a: []}, {$pushAll: {a: [1]}}, {a: [1]});
  modify({a: [1]}, {$pushAll: {a: [2]}}, {a: [1, 2]});
  modify({}, {$pushAll: {a: [1, 2]}}, {a: [1, 2]});
  modify({a: []}, {$pushAll: {a: [1, 2]}}, {a: [1, 2]});
  modify({a: [1]}, {$pushAll: {a: [2, 3]}}, {a: [1, 2, 3]});
  modify({}, {$pushAll: {a: []}}, {a: []});
  modify({a: []}, {$pushAll: {a: []}}, {a: []});
  modify({a: [1]}, {$pushAll: {a: []}}, {a: [1]});
  exception({a: true}, {$pushAll: {a: [1]}});
  exception({a: []}, {$pushAll: {a: 1}});
  modify({a: []}, {$pushAll: {'a.1': [99]}}, {a: [null, [99]]});
  modify({a: []}, {$pushAll: {'a.1': []}}, {a: [null, []]});
  modify({a: {}}, {$pushAll: {'a.x': [99]}}, {a: {x: [99]}});
  modify({a: {}}, {$pushAll: {'a.x': []}}, {a: {x: []}});

  // $addToSet
  modify({}, {$addToSet: {a: 1}}, {a: [1]});
  modify({a: []}, {$addToSet: {a: 1}}, {a: [1]});
  modify({a: [1]}, {$addToSet: {a: 2}}, {a: [1, 2]});
  modify({a: [1, 2]}, {$addToSet: {a: 1}}, {a: [1, 2]});
  modify({a: [1, 2]}, {$addToSet: {a: 2}}, {a: [1, 2]});
  modify({a: [1, 2]}, {$addToSet: {a: 3}}, {a: [1, 2, 3]});
  exception({a: true}, {$addToSet: {a: 1}});
  modify({a: [1]}, {$addToSet: {a: [2]}}, {a: [1, [2]]});
  modify({}, {$addToSet: {a: {x: 1}}}, {a: [{x: 1}]});
  modify({a: [{x: 1}]}, {$addToSet: {a: {x: 1}}}, {a: [{x: 1}]});
  modify({a: [{x: 1}]}, {$addToSet: {a: {x: 2}}}, {a: [{x: 1}, {x: 2}]});
  modify({a: [{x: 1, y: 2}]}, {$addToSet: {a: {x: 1, y: 2}}},
         {a: [{x: 1, y: 2}]});
  modify({a: [{x: 1, y: 2}]}, {$addToSet: {a: {y: 2, x: 1}}},
         {a: [{x: 1, y: 2}, {y: 2, x: 1}]});
  modify({a: [1, 2]}, {$addToSet: {a: {$each: [3, 1, 4]}}}, {a: [1, 2, 3, 4]});
  modify({a: [1, 2]}, {$addToSet: {a: {$each: [3, 1, 4], b: 12}}},
         {a: [1, 2, 3, 4]}); // tested
  modify({a: [1, 2]}, {$addToSet: {a: {b: 12, $each: [3, 1, 4]}}},
         {a: [1, 2, {b: 12, $each: [3, 1, 4]}]}); // tested
  modify({}, {$addToSet: {a: {$each: []}}}, {a: []});
  modify({}, {$addToSet: {a: {$each: [1]}}}, {a: [1]});
  modify({a: []}, {$addToSet: {'a.1': 99}}, {a: [null, [99]]});
  modify({a: {}}, {$addToSet: {'a.x': 99}}, {a: {x: [99]}});

  // $pop
  modify({}, {$pop: {a: 1}}, {}); // tested
  modify({}, {$pop: {a: -1}}, {}); // tested
  modify({a: []}, {$pop: {a: 1}}, {a: []});
  modify({a: []}, {$pop: {a: -1}}, {a: []});
  modify({a: [1, 2, 3]}, {$pop: {a: 1}}, {a: [1, 2]});
  modify({a: [1, 2, 3]}, {$pop: {a: 10}}, {a: [1, 2]});
  modify({a: [1, 2, 3]}, {$pop: {a: .001}}, {a: [1, 2]});
  modify({a: [1, 2, 3]}, {$pop: {a: 0}}, {a: [1, 2]});
  modify({a: [1, 2, 3]}, {$pop: {a: "stuff"}}, {a: [1, 2]});
  modify({a: [1, 2, 3]}, {$pop: {a: -1}}, {a: [2, 3]});
  modify({a: [1, 2, 3]}, {$pop: {a: -10}}, {a: [2, 3]});
  modify({a: [1, 2, 3]}, {$pop: {a: -.001}}, {a: [2, 3]});
  exception({a: true}, {$pop: {a: 1}});
  exception({a: true}, {$pop: {a: -1}});
  modify({a: []}, {$pop: {'a.1': 1}}, {a: []}); // tested
  modify({a: [1, [2, 3], 4]}, {$pop: {'a.1': 1}}, {a: [1, [2], 4]});
  modify({a: {}}, {$pop: {'a.x': 1}}, {a: {}}); // tested
  modify({a: {x: [2, 3]}}, {$pop: {'a.x': 1}}, {a: {x: [2]}});

  // $pull
  modify({}, {$pull: {a: 1}}, {});
  modify({}, {$pull: {'a.x': 1}}, {});
  modify({a: {}}, {$pull: {'a.x': 1}}, {a: {}});
  exception({a: true}, {$pull: {a: 1}});
  modify({a: [2, 1, 2]}, {$pull: {a: 1}}, {a: [2, 2]});
  modify({a: [2, 1, 2]}, {$pull: {a: 2}}, {a: [1]});
  modify({a: [2, 1, 2]}, {$pull: {a: 3}}, {a: [2, 1, 2]});
  modify({a: [1, null, 2, null]}, {$pull: {a: null}}, {a: [1, 2]});
  modify({a: []}, {$pull: {a: 3}}, {a: []});
  modify({a: [[2], [2, 1], [3]]}, {$pull: {a: [2, 1]}},
         {a: [[2], [3]]}); // tested
  modify({a: [{b: 1, c: 2}, {b: 2, c: 2}]}, {$pull: {a: {b: 1}}},
         {a: [{b: 2, c: 2}]});
  modify({a: [{b: 1, c: 2}, {b: 2, c: 2}]}, {$pull: {a: {c: 2}}},
         {a: []});
  // XXX implement this functionality!
  // probably same refactoring as $elemMatch?
  // modify({a: [1, 2, 3, 4]}, {$pull: {$gt: 2}}, {a: [1,2]}); fails!

  // $pullAll
  modify({}, {$pullAll: {a: [1]}}, {});
  modify({a: [1, 2, 3]}, {$pullAll: {a: []}}, {a: [1, 2, 3]});
  modify({a: [1, 2, 3]}, {$pullAll: {a: [2]}}, {a: [1, 3]});
  modify({a: [1, 2, 3]}, {$pullAll: {a: [2, 1]}}, {a: [3]});
  modify({a: [1, 2, 3]}, {$pullAll: {a: [1, 2]}}, {a: [3]});
  modify({}, {$pullAll: {'a.b.c': [2]}}, {});
  exception({a: true}, {$pullAll: {a: [1]}});
  exception({a: [1, 2, 3]}, {$pullAll: {a: 1}});
  modify({x: [{a: 1}, {a: 1, b: 2}]}, {$pullAll: {x: [{a: 1}]}},
         {x: [{a: 1, b: 2}]});

  // $rename
  modify({}, {$rename: {a: 'b'}}, {});
  modify({a: [12]}, {$rename: {a: 'b'}}, {b: [12]});
  modify({a: {b: 12}}, {$rename: {a: 'c'}}, {c: {b: 12}});
  modify({a: {b: 12}}, {$rename: {'a.b': 'a.c'}}, {a: {c: 12}});
  modify({a: {b: 12}}, {$rename: {'a.b': 'x'}}, {a: {}, x: 12}); // tested
  modify({a: {b: 12}}, {$rename: {'a.b': 'q.r'}}, {a: {}, q: {r: 12}});
  modify({a: {b: 12}}, {$rename: {'a.b': 'q.2.r'}}, {a: {}, q: {2: {r: 12}}});
  modify({a: {b: 12}, q: {}}, {$rename: {'a.b': 'q.2.r'}},
         {a: {}, q: {2: {r: 12}}});
  exception({a: {b: 12}, q: []}, {$rename: {'a.b': 'q.2'}}); // tested
  exception({a: {b: 12}, q: []}, {$rename: {'a.b': 'q.2.r'}}); // tested
  // These strange MongoDB behaviors throw.
  // modify({a: {b: 12}, q: []}, {$rename: {'q.1': 'x'}},
  //        {a: {b: 12}, x: []}); // tested
  // modify({a: {b: 12}, q: []}, {$rename: {'q.1.j': 'x'}},
  //        {a: {b: 12}, x: []}); // tested
  exception({}, {$rename: {'a': 'a'}});
  exception({}, {$rename: {'a.b': 'a.b'}});
  modify({a: 12, b: 13}, {$rename: {a: 'b'}}, {b: 12});

  // $bit
  // unimplemented

  // XXX test case sensitivity of modops
  // XXX for each (most) modop, test that it performs a deep copy
});