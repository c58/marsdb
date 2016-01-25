import Random from '../../lib/Random';
import chai, {except, assert} from 'chai';
import _ from 'lodash';
chai.use(require('chai-as-promised'));
chai.should();

describe('Random', function () {
  it('should generate random with seed', function () {
    // Deterministic with a specified seed, which should generate the
    // same sequence in all environments.
    //
    // For repeatable unit test failures using deterministic random
    // number sequences it's fine if a new Meteor release changes the
    // algorithm being used and it starts generating a different
    // sequence for a seed, as long as the sequence is consistent for
    // a particular release.
    var random = Random.createWithSeeds(0);
    assert.equal(random.id(), "cp9hWvhg8GSvuZ9os");
    assert.equal(random.id(), "3f3k6Xo7rrHCifQhR");
    assert.equal(random.id(), "shxDnjWWmnKPEoLhM");
    assert.equal(random.id(), "6QTjB8C5SEqhmz4ni");
  });

  it('should generate number with specified format without seed', function () {
    var idLen = 17;
    assert.equal(Random.default().id().length, idLen);
    assert.equal(Random.default().id(29).length, 29);
    var numDigits = 9;
    var hexStr = Random.default().hexString(numDigits);
    assert.equal(hexStr.length, numDigits);
    parseInt(hexStr, 16); // should not throw
    var frac = Random.default().fraction();
    assert.isTrue(frac < 1.0);
    assert.isTrue(frac >= 0.0);

    assert.equal(Random.default().secret().length, 43);
    assert.equal(Random.default().secret(13).length, 13);
  });

  it('should select Alea only in final resort', function () {
    if (typeof window === 'undefined') {
      assert.isTrue(Random.default().alea === undefined);
    } else {
      var useGetRandomValues = !!(typeof window !== "undefined" &&
        window.crypto && window.crypto.getRandomValues);
      assert.equal(Random.default().alea === undefined, useGetRandomValues);
    }
  });

  it('should rise an exception if no seed provided', function () {
    assert.throws(function () {
      Random.createWithSeeds();
    });
  });
});
