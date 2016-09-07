'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._getBrowserSeeds = _getBrowserSeeds;

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Intarnals
var _defaultRandomGenerator = undefined;
var RANDOM_GENERATOR_TYPE = {
  NODE_CRYPTO: 'NODE_CRYPTO',
  BROWSER_CRYPTO: 'BROWSER_CRYPTO',
  ALEA: 'ALEA'
};
var UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
var BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789-_';

// see http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
// for a full discussion and Alea implementation.
var Alea = function Alea() {
  function Mash() {
    var n = 0xefc8249d;

    var mash = function mash(data) {
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

  return function (args) {
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

    var random = function random() {
      var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
      s0 = s1;
      s1 = s2;
      return s2 = t - (c = t | 0);
    };
    random.uint32 = function () {
      return random() * 0x100000000; // 2^32
    };
    random.fract53 = function () {
      return random() + (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
    };
    random.version = 'Alea 0.9';
    random.args = args;
    return random;
  }(Array.prototype.slice.call(arguments));
};

/**
 * Create seeds array for a browser based on window sizes,
 * Date and some random number.
 * @return {Arrat}
 */
function _getBrowserSeeds() {
  var height = typeof window !== 'undefined' && window.innerHeight || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientHeight || typeof document !== 'undefined' && document.body && document.body.clientHeight || 1;

  var width = typeof window !== 'undefined' && window.innerWidth || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientWidth || typeof document !== 'undefined' && document.body && document.body.clientWidth || 1;

  var agent = typeof navigator !== 'undefined' && navigator.userAgent || '';
  return [new Date(), height, width, agent, Math.random()];
}

/**
 * Random string generator copied from Meteor
 * with minor modifications and refactoring.
 */

var Random = function () {
  function Random(type) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Random);

    this.type = type;

    (0, _invariant2.default)(RANDOM_GENERATOR_TYPE[type], 'Random(...): no generator type %s', type);

    if (type === RANDOM_GENERATOR_TYPE.ALEA) {
      (0, _invariant2.default)(options.seeds, 'Random(...): seed is not provided for ALEA seeded generator');
      this.alea = Alea.apply(null, options.seeds);
    }
  }

  _createClass(Random, [{
    key: 'fraction',
    value: function fraction() {
      if (this.type === RANDOM_GENERATOR_TYPE.ALEA) {
        return this.alea();
      } else if (this.type === RANDOM_GENERATOR_TYPE.NODE_CRYPTO) {
        var numerator = parseInt(this.hexString(8), 16);
        return numerator * 2.3283064365386963e-10; // 2^-32
      } else if (this.type === RANDOM_GENERATOR_TYPE.BROWSER_CRYPTO) {
          var array = new Uint32Array(1);
          window.crypto.getRandomValues(array);
          return array[0] * 2.3283064365386963e-10; // 2^-32
        } else {
            throw new Error('Unknown random generator type: ' + this.type);
          }
    }
  }, {
    key: 'hexString',
    value: function hexString(digits) {
      if (this.type === RANDOM_GENERATOR_TYPE.NODE_CRYPTO) {
        var _ret = function () {
          var nodeCrypto = require('crypto');
          var numBytes = Math.ceil(digits / 2);

          // Try to get cryptographically strong randomness. Fall back to
          // non-cryptographically strong if not available.
          var bytes = (0, _try3.default)(function () {
            return nodeCrypto.randomBytes(numBytes);
          });
          if (bytes instanceof Error) {
            bytes = nodeCrypto.pseudoRandomBytes(numBytes);
          }

          var result = bytes.toString('hex');
          // If the number of digits is odd, we'll have generated an extra 4 bits
          // of randomness, so we need to trim the last digit.
          return {
            v: result.substring(0, digits)
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      } else {
        return this._randomString(digits, '0123456789abcdef');
      }
    }
  }, {
    key: '_randomString',
    value: function _randomString(charsCount, alphabet) {
      var digits = [];
      for (var i = 0; i < charsCount; i++) {
        digits[i] = this.choice(alphabet);
      }
      return digits.join('');
    }
  }, {
    key: 'id',
    value: function id(charsCount) {
      // 17 characters is around 96 bits of entropy, which is the amount of
      // state in the Alea PRNG.
      if (charsCount === undefined) {
        charsCount = 17;
      }
      return this._randomString(charsCount, UNMISTAKABLE_CHARS);
    }
  }, {
    key: 'secret',
    value: function secret(charsCount) {
      // Default to 256 bits of entropy, or 43 characters at 6 bits per
      // character.
      if (charsCount === undefined) {
        charsCount = 43;
      }
      return this._randomString(charsCount, BASE64_CHARS);
    }
  }, {
    key: 'choice',
    value: function choice(arrayOrString) {
      var index = Math.floor(this.fraction() * arrayOrString.length);
      if (typeof arrayOrString === 'string') {
        return arrayOrString.substr(index, 1);
      } else {
        return arrayOrString[index];
      }
    }
  }], [{
    key: 'default',
    value: function _default() {
      if (!_defaultRandomGenerator) {
        if (typeof window !== 'undefined') {
          if (window.crypto && window.crypto.getRandomValues) {
            return new Random(RANDOM_GENERATOR_TYPE.BROWSER_CRYPTO);
          } else {
            return new Random(RANDOM_GENERATOR_TYPE.ALEA, { seeds: _getBrowserSeeds() });
          }
        } else {
          return new Random(RANDOM_GENERATOR_TYPE.NODE_CRYPTO);
        }
      }
      return _defaultRandomGenerator;
    }
  }, {
    key: 'createWithSeeds',
    value: function createWithSeeds() {
      (0, _invariant2.default)(arguments.length, 'Random.createWithSeeds(...): no seeds were provided');

      return new Random(RANDOM_GENERATOR_TYPE.ALEA, { seeds: arguments });
    }
  }]);

  return Random;
}();

exports.default = Random;