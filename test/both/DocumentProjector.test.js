import EJSON from '../../lib/EJSON';
import DocumentProjector, * as utils from '../../lib/DocumentProjector';
import chai, {except, assert} from 'chai';
import _ from 'lodash';
chai.use(require('chai-as-promised'));
chai.should();


describe('DocumentProjector', function () {
  describe('projection_compiler', function () {
    var testProjection = function (projection, tests) {
      var projector = new DocumentProjector(projection);
      _.each(tests, function (testCase) {
        it(testCase[2], function() {
          assert.deepEqual(
            projector.project(testCase[0]),
            testCase[1],
            testCase[2]
          );
        });
      });
    };

    var testCompileProjectionThrows = function (projection, expectedError) {
      it('should throw an error', function () {
        assert.throws(function () {
          new DocumentProjector(projection)
        }, expectedError);
      });
    };

    testProjection({ 'foo': 1, 'bar': 1 }, [
      [{ foo: 42, bar: "something", baz: "else" },
       { foo: 42, bar: "something" },
       "simplest - whitelist"],

      [{ foo: { nested: 17 }, baz: {} },
       { foo: { nested: 17 } },
       "nested whitelisted field"],

      [{ _id: "uid", bazbaz: 42 },
       { _id: "uid" },
       "simplest whitelist - preserve _id"]
    ]);

    testProjection({ 'foo': 0, 'bar': 0 }, [
      [{ foo: 42, bar: "something", baz: "else" },
       { baz: "else" },
       "simplest - blacklist"],

      [{ foo: { nested: 17 }, baz: { foo: "something" } },
       { baz: { foo: "something" } },
       "nested blacklisted field"],

      [{ _id: "uid", bazbaz: 42 },
       { _id: "uid", bazbaz: 42 },
       "simplest blacklist - preserve _id"]
    ]);

    testProjection({ _id: 0, foo: 1 }, [
      [{ foo: 42, bar: 33, _id: "uid" },
       { foo: 42 },
       "whitelist - _id blacklisted"]
    ]);

    testProjection({ _id: 0, foo: 0 }, [
      [{ foo: 42, bar: 33, _id: "uid" },
       { bar: 33 },
       "blacklist - _id blacklisted"]
    ]);

    testProjection({ 'foo.bar.baz': 1 }, [
      [{ foo: { meh: "fur", bar: { baz: 42 }, tr: 1 }, bar: 33, baz: 'trolololo' },
       { foo: { bar: { baz: 42 } } },
       "whitelist nested"],

      // Behavior of this test is looked up in actual mongo
      [{ foo: { meh: "fur", bar: "nope", tr: 1 }, bar: 33, baz: 'trolololo' },
       { foo: {} },
       "whitelist nested - path not found in doc, different type"],

      // Behavior of this test is looked up in actual mongo
      [{ foo: { meh: "fur", bar: [], tr: 1 }, bar: 33, baz: 'trolololo' },
       { foo: { bar: [] } },
       "whitelist nested - path not found in doc"]
    ]);

    testProjection({ 'hope.humanity': 0, 'hope.people': 0 }, [
      [{ hope: { humanity: "lost", people: 'broken', candies: 'long live!' } },
       { hope: { candies: 'long live!' } },
       "blacklist nested"],

      [{ hope: "new" },
       { hope: "new" },
       "blacklist nested - path not found in doc"]
    ]);

    testProjection({ _id: 1 }, [
      [{ _id: 42, x: 1, y: { z: "2" } },
       { _id: 42 },
       "_id whitelisted"],
      [{ _id: 33 },
       { _id: 33 },
       "_id whitelisted, _id only"],
      [{ x: 1 },
       {},
       "_id whitelisted, no _id"]
    ]);

    testProjection({ _id: 0 }, [
      [{ _id: 42, x: 1, y: { z: "2" } },
       { x: 1, y: { z: "2" } },
       "_id blacklisted"],
      [{ _id: 33 },
       {},
       "_id blacklisted, _id only"],
      [{ x: 1 },
       { x: 1 },
       "_id blacklisted, no _id"]
    ]);

    testProjection({}, [
      [{ a: 1, b: 2, c: "3" },
       { a: 1, b: 2, c: "3" },
       "empty projection"]
    ]);

    testCompileProjectionThrows(
      { 'inc': 1, 'excl': 0 },
      "You cannot currently mix including and excluding fields");
    testCompileProjectionThrows(
      { _id: 1, a: 0 },
      "You cannot currently mix including and excluding fields");

    testCompileProjectionThrows(
      { 'a': 1, 'a.b': 1 },
      "using both of them may trigger unexpected behavior");
    testCompileProjectionThrows(
      { 'a.b.c': 1, 'a.b': 1, 'a': 1 },
      "using both of them may trigger unexpected behavior");

    testCompileProjectionThrows("some string", "fields option must be an object");
  });


  it('shoutl copy document', function () {
    // Compiled fields projection defines the contract: returned document doesn't
    // retain anything from the passed argument.
    var doc = {
      a: { x: 42 },
      b: {
        y: { z: 33 }
      },
      c: "asdf"
    };

    var fields = {
      'a': 1,
      'b.y': 1
    };

    var projectionFn = new DocumentProjector(fields);
    var filteredDoc = projectionFn.project(doc);
    doc.a.x++;
    doc.b.y.z--;
    assert.equal(filteredDoc.a.x, 42, "projection returning deep copy - including");
    assert.equal(filteredDoc.b.y.z, 33, "projection returning deep copy - including");

    fields = { c: 0 };
    projectionFn = new DocumentProjector(fields);
    filteredDoc = projectionFn.project(doc);

    doc.a.x = 5;
    assert.equal(filteredDoc.a.x, 43, "projection returning deep copy - excluding");
  });

});
