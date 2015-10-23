import EJSON from '../../lib/EJSON';
import chai, {except, assert} from 'chai';
import _ from 'lodash';
chai.use(require('chai-as-promised'));
chai.should();

describe('EJSON', function () {
  it('should be key order sensetive', function() {
    EJSON.equals({
      a: {b: 1, c: 2},
      d: {e: 3, f: 4}
    }, {
      d: {f: 4, e: 3},
      a: {c: 2, b: 1}
    }).should.be.true;

    EJSON.equals({
      a: {b: 1, c: 2},
      d: {e: 3, f: 4}
    }, {
      d: {f: 4, e: 3},
      a: {c: 2, b: 1}
    }, {keyOrderSensitive: true}).should.be.false;

    EJSON.equals({
      a: {b: 1, c: 2},
      d: {e: 3, f: 4}
    }, {
      a: {c: 2, b: 1},
      d: {f: 4, e: 3}
    }, {keyOrderSensitive: true}).should.be.false;
    EJSON.equals({a: {}}, {a: {b:2}},
      {keyOrderSensitive: true}).should.be.false;
    EJSON.equals({a: {b:2}}, {a: {}},
      {keyOrderSensitive: true}).should.be.false;
  });

  it('should support nested and literal', function() {
    var d = new Date;
    var obj = {$date: d};
    var eObj = EJSON.toJSONValue(obj);
    var roundTrip = EJSON.fromJSONValue(eObj);
    obj.should.be.deep.equals(roundTrip);
  });

  it('should accept more complex equality', function() {
    EJSON.equals({a: 1, b: 2, c: 3}, {a: 1, c: 3, b: 2}).should.be.true;
    EJSON.equals({a: 1, b: 2}, {a: 1, c: 3, b: 2}).should.be.false;
    EJSON.equals({a: 1, b: 2, c: 3}, {a: 1, b: 2}).should.be.false;
    EJSON.equals({a: 1, b: 2, c: 3}, {a: 1, c: 3, b: 4}).should.be.false;
    EJSON.equals({a: {}}, {a: {b:2}}).should.be.false;
    EJSON.equals({a: {b:2}}, {a: {}}).should.be.false;
  });

  it('should accept equality of null and undefined', function() {
    EJSON.equals(null, null).should.be.true;
    EJSON.equals(undefined, undefined).should.be.true;
    EJSON.equals({foo: "foo"}, null).should.be.false;
    EJSON.equals(null, {foo: "foo"}).should.be.false;
    EJSON.equals(undefined, {foo: "foo"}).should.be.false;
    EJSON.equals({foo: "foo"}, undefined).should.be.false;
  });

  it('should accept equality of Nan and Inf', function() {
    EJSON.parse("{\"$InfNaN\": 1}").should.be.equals(Infinity);
    EJSON.parse("{\"$InfNaN\": -1}").should.be.equals(-Infinity);
    _.isNaN(EJSON.parse("{\"$InfNaN\": 0}")).should.be.true;
    EJSON.parse(EJSON.stringify(Infinity)).should.be.equals(Infinity);
    EJSON.parse(EJSON.stringify(-Infinity)).should.be.equals(-Infinity);
    _.isNaN(EJSON.parse(EJSON.stringify(NaN))).should.be.true;
    EJSON.equals(NaN, NaN).should.be.true;
    EJSON.equals(Infinity, Infinity).should.be.true;
    EJSON.equals(-Infinity, -Infinity).should.be.true;
    EJSON.equals(Infinity, -Infinity).should.be.false;
    EJSON.equals(Infinity, NaN).should.be.false;
    EJSON.equals(Infinity, 0).should.be.false;
    EJSON.equals(NaN, 0).should.be.false;

    EJSON.equals(
      EJSON.parse("{\"a\": {\"$InfNaN\": 1}}"),
      {a: Infinity}
    ).should.be.true;
    EJSON.equals(
      EJSON.parse("{\"a\": {\"$InfNaN\": 0}}"),
      {a: NaN}
    ).should.be.true;
  });

  it('should clone', function() {
    var cloneTest = function (x, identical) {
      var y = EJSON.clone(x);
      EJSON.equals(x, y).should.be.true;
      (x === y).should.be.equals(!!identical);
    };
    cloneTest(null, true);
    cloneTest(undefined, true);
    cloneTest(42, true);
    cloneTest("asdf", true);
    cloneTest([1, 2, 3]);
    cloneTest([1, "fasdf", {foo: 42}]);
    cloneTest({x: 42, y: "asdf"});

    var testCloneArgs = function (/*arguments*/) {
      EJSON.clone(arguments).should.be.deep.equals([1, 2, "foo", [4]]);
    };
    testCloneArgs(1, 2, "foo", [4]);
  });

  it('should stringify object', function() {
    assert.equal(EJSON.stringify(null), "null");
    assert.equal(EJSON.stringify(true), "true");
    assert.equal(EJSON.stringify(false), "false");
    assert.equal(EJSON.stringify(123), "123");
    assert.equal(EJSON.stringify("abc"), "\"abc\"");

    assert.equal(EJSON.stringify([1, 2, 3]),
       "[1,2,3]"
    );

    assert.deepEqual(
      EJSON.parse(EJSON.stringify({b: [2, {d: 4, c: 3}], a: 1})),
      {b: [2, {d: 4, c: 3}], a: 1}
    );
  });

  it('should parse', function() {
    assert.deepEqual(EJSON.parse("[1,2,3]"), [1,2,3]);
    assert.throws(
      function () { EJSON.parse(null) },
      /argument should be a string/
    );
  });

  it('should support custom types', function() {
    // Address type
    class Address {
      constructor(city, state) {
        this.city = city;
        this.state = state;
      }
      typeName() {
        return "Address";
      }
      toJSONValue() {
        return {
          city: this.city,
          state: this.state
        };
      }
    }
    EJSON.addType("Address", function fromJSONValue(value) {
      return new Address(value.city, value.state);
    });

    // Person type
    class Person {
      constructor(name, dob, address) {
        this.name = name;
        this.dob = dob;
        this.address = address;
      }
      typeName() {
        return "Person";
      }
      toJSONValue() {
        return {
          name: this.name,
          dob: EJSON.toJSONValue(this.dob),
          address: EJSON.toJSONValue(this.address)
        };
      }
      static fromJSONValue(value) {
        return new Person(
          value.name,
          EJSON.fromJSONValue(value.dob),
          EJSON.fromJSONValue(value.address)
        );
      }
    }
    EJSON.addType("Person", Person.fromJSONValue);

    // Holder type
    class Holder {
      constructor(content) {
        this.content = content;
      }
      typeName() {
        return "Holder";
      }
      toJSONValue() {
        return this.content;
      }
      static fromJSONValue(value) {
        return new Holder(value);
      }
    }
    EJSON.addType("Holder", Holder.fromJSONValue);

    var testSameConstructors = function (obj, compareWith) {
      assert.equal(obj.constructor, compareWith.constructor);
      if (typeof obj === 'object') {
        _.keys(obj).forEach(k => {
          testSameConstructors(obj[k], compareWith[k]);
        });
      }
    }
    var testReallyEqual = function (obj, compareWith) {
      assert.deepEqual(obj, compareWith);
      testSameConstructors(obj, compareWith);
    }
    var testRoundTrip = function (obj) {
      var str = EJSON.stringify(obj);
      var roundTrip = EJSON.parse(str);
      testReallyEqual(obj, roundTrip);
    }
    var testCustomObject = function (obj) {
      testRoundTrip(obj);
      testReallyEqual(obj, EJSON.clone(obj));
    }

    var a = new Address('Montreal', 'Quebec');
    testCustomObject( {address: a} );
    // Test that difference is detected even if they
    // have similar toJSONValue results:
    var nakedA = {city: 'Montreal', state: 'Quebec'};
    assert.notEqual(nakedA, a);
    assert.notEqual(a, nakedA);
    var holder = new Holder(nakedA);
    assert.deepEqual(holder.toJSONValue(), a.toJSONValue()); // sanity check
    assert.notEqual(holder, a);
    assert.notEqual(a, holder);


    var d = new Date;
    var obj = new Person("John Doe", d, a);
    testCustomObject( obj );

    // Test clone is deep:
    var clone = EJSON.clone(obj);
    clone.address.city = 'Sherbrooke';
    assert.notEqual( obj, clone );
  });
});
