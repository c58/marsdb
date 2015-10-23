import Base64 from '../../lib/Base64';
import EJSON from '../../lib/EJSON';
import chai, {except, assert} from 'chai';
chai.use(require('chai-as-promised'));
chai.should();


var asciiToArray = function (str) {
  var arr = Base64.newBinary(str.length);
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c > 0xFF) {
      throw new Error("Not ascii");
    }
    arr[i] = c;
  }
  return arr;
};

var arrayToAscii = function (arr) {
  var res = [];
  for (var i = 0; i < arr.length; i++) {
    res.push(String.fromCharCode(arr[i]));
  }
  return res.join("");
};

describe('Base64', function () {
  it('should encode and decode', function () {
    assert.equal(arrayToAscii(asciiToArray("The quick brown fox jumps over the lazy dog")),
             "The quick brown fox jumps over the lazy dog");
  });

  it('should accept empty and produce empty string', function () {
    assert.deepEqual(Base64.encode(EJSON.newBinary(0)), "");
    assert.deepEqual(Base64.decode(""), EJSON.newBinary(0));
  });

  it('should accept wikipedia example', function () {
    var tests = [
      {txt: "pleasure.", res: "cGxlYXN1cmUu"},
      {txt: "leasure.", res: "bGVhc3VyZS4="},
      {txt: "easure.", res: "ZWFzdXJlLg=="},
      {txt: "asure.", res: "YXN1cmUu"},
      {txt: "sure.", res: "c3VyZS4="}
    ];
    tests.forEach(function(t) {
      assert.deepEqual(Base64.encode(asciiToArray(t.txt)), t.res);
      assert.deepEqual(arrayToAscii(Base64.decode(t.res)), t.txt);
    });
  });

  it('should accept non-text data', function() {
    var tests = [
      {array: [0, 0, 0], b64: "AAAA"},
      {array: [0, 0, 1], b64: "AAAB"}
    ];
    tests.forEach(function(t) {
      assert.deepEqual(Base64.encode(t.array), t.b64);
      var expectedAsBinary = EJSON.newBinary(t.array.length);
      t.array.forEach(function (val, i) {
        expectedAsBinary[i] = val;
      });
      assert.deepEqual(Base64.decode(t.b64), expectedAsBinary);
    });
  });
});
