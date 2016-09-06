import _try from 'fast.js/function/try';
import invariant from 'invariant';


// Intarnals
let _defaultRandomGenerator;
const RANDOM_GENERATOR_TYPE = {
  NODE_CRYPTO: 'NODE_CRYPTO',
  BROWSER_CRYPTO: 'BROWSER_CRYPTO',
  ALEA: 'ALEA',
};
const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789-_';

// see http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
// for a full discussion and Alea implementation.
const Alea = function() {
  function Mash() {
    var n = 0xefc8249d;

    var mash = function(data) {
      data = data.toString();
      for (var i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        var h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };

    mash.version = 'Mash 0.9';
    return mash;
  }

  return (function(args) {
    var s0 = 0;
    var s1 = 0;
    var s2 = 0;
    var c = 1;

    if (args.length == 0) {
      args = [+new Date()];
    }
    var mash = Mash();
    s0 = mash(' ');
    s1 = mash(' ');
    s2 = mash(' ');

    for (var i = 0; i < args.length; i++) {
      s0 -= mash(args[i]);
      if (s0 < 0) {
        s0 += 1;
      }
      s1 -= mash(args[i]);
      if (s1 < 0) {
        s1 += 1;
      }
      s2 -= mash(args[i]);
      if (s2 < 0) {
        s2 += 1;
      }
    }
    mash = null;

    var random = function() {
      var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
      s0 = s1;
      s1 = s2;
      return s2 = t - (c = t | 0);
    };
    random.uint32 = function() {
      return random() * 0x100000000; // 2^32
    };
    random.fract53 = function() {
      return random() +
        (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
    };
    random.version = 'Alea 0.9';
    random.args = args;
    return random;

  }(Array.prototype.slice.call(arguments)));
};

/**
 * Create seeds array for a browser based on window sizes,
 * Date and some random number.
 * @return {Arrat}
 */
export function _getBrowserSeeds() {
  var height = (typeof window !== 'undefined' && window.innerHeight) ||
    (typeof document !== 'undefined'
     && document.documentElement
     && document.documentElement.clientHeight) ||
    (typeof document !== 'undefined'
     && document.body
     && document.body.clientHeight) ||
    1;

  var width = (typeof window !== 'undefined' && window.innerWidth) ||
    (typeof document !== 'undefined'
     && document.documentElement
     && document.documentElement.clientWidth) ||
    (typeof document !== 'undefined'
     && document.body
     && document.body.clientWidth) ||
    1;

  var agent = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  return [new Date(), height, width, agent, Math.random()];
}

/**
 * Random string generator copied from Meteor
 * with minor modifications and refactoring.
 */
export default class Random {
  constructor(type, options = {}) {
    this.type = type;

    invariant(
      RANDOM_GENERATOR_TYPE[type],
      'Random(...): no generator type %s',
      type
    );

    if (type === RANDOM_GENERATOR_TYPE.ALEA) {
      invariant(
        options.seeds,
        'Random(...): seed is not provided for ALEA seeded generator'
      );
      this.alea = Alea.apply(null, options.seeds);
    }
  }

  fraction() {
    if (this.type === RANDOM_GENERATOR_TYPE.ALEA) {
      return this.alea();
    } else if (this.type === RANDOM_GENERATOR_TYPE.NODE_CRYPTO) {
      const numerator = parseInt(this.hexString(8), 16);
      return numerator * 2.3283064365386963e-10; // 2^-32
    } else if (this.type === RANDOM_GENERATOR_TYPE.BROWSER_CRYPTO) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] * 2.3283064365386963e-10; // 2^-32
    } else {
      throw new Error('Unknown random generator type: ' + this.type);
    }
  }

  hexString(digits) {
    if (this.type === RANDOM_GENERATOR_TYPE.NODE_CRYPTO) {
      const nodeCrypto = require('crypto');
      const numBytes = Math.ceil(digits / 2);

      // Try to get cryptographically strong randomness. Fall back to
      // non-cryptographically strong if not available.
      let bytes = _try(() => nodeCrypto.randomBytes(numBytes));
      if (bytes instanceof Error) {
        bytes = nodeCrypto.pseudoRandomBytes(numBytes);
      }

      const result = bytes.toString('hex');
      // If the number of digits is odd, we'll have generated an extra 4 bits
      // of randomness, so we need to trim the last digit.
      return result.substring(0, digits);
    } else {
      return this._randomString(digits, '0123456789abcdef');
    }
  }

  _randomString(charsCount, alphabet) {
    const digits = [];
    for (let i = 0; i < charsCount; i++) {
      digits[i] = this.choice(alphabet);
    }
    return digits.join('');
  }

  id(charsCount) {
    // 17 characters is around 96 bits of entropy, which is the amount of
    // state in the Alea PRNG.
    if (charsCount === undefined) {
      charsCount = 17;
    }
    return this._randomString(charsCount, UNMISTAKABLE_CHARS);
  }

  secret(charsCount) {
    // Default to 256 bits of entropy, or 43 characters at 6 bits per
    // character.
    if (charsCount === undefined) {
      charsCount = 43;
    }
    return this._randomString(charsCount, BASE64_CHARS);
  }

  choice(arrayOrString) {
    const index = Math.floor(this.fraction() * arrayOrString.length);
    if (typeof arrayOrString === 'string') {
      return arrayOrString.substr(index, 1);
    } else {
      return arrayOrString[index];
    }
  }

  static default() {
    if (!_defaultRandomGenerator) {
      if (typeof window !== 'undefined') {
        if (window.crypto && window.crypto.getRandomValues) {
          return new Random(RANDOM_GENERATOR_TYPE.BROWSER_CRYPTO);
        } else {
          return new Random(
            RANDOM_GENERATOR_TYPE.ALEA,
            { seeds: _getBrowserSeeds() }
          );
        }
      } else {
        return new Random(RANDOM_GENERATOR_TYPE.NODE_CRYPTO);
      }
    }
    return _defaultRandomGenerator;
  }

  static createWithSeeds() {
    invariant(
      arguments.length,
      'Random.createWithSeeds(...): no seeds were provided'
    );

    return new Random(
      RANDOM_GENERATOR_TYPE.ALEA,
      { seeds: arguments }
    );
  }
}
