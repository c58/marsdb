// see http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
// for a full discussion and Alea implementation.
var Alea = function() {
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


var UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
var BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789-_';


export class Random {
  constructor() {
    // Get first argumnts with this method
    // because ngInject tries to inject any
    // service from a declared consturcor
    var seedArray = arguments[0];

    // Get default seed in the browser
    if (seedArray === undefined &&
      !(typeof window !== 'undefined' &&
        window.crypto && window.crypto.getRandomValues)) {
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
      seedArray = [new Date(), height, width, agent, Math.random()];
    }

    // Use Alea then seed provided
    if (seedArray !== undefined) {
      this.alea = Alea.apply(null, seedArray);
    }
  }

  fraction() {
    var self = this;
    if (self.alea) {
      return self.alea();
    } else if (typeof window !== 'undefined' && window.crypto &&
               window.crypto.getRandomValues) {
      var array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] * 2.3283064365386963e-10; // 2^-32
    } else {
      throw new Error('No random generator available');
    }
  }

  hexString(digits) {
    var self = this;
    var hexDigits = [];

    for (var i = 0; i < digits; ++i) {
      hexDigits.push(self.choice('0123456789abcdef'));
    }

    return hexDigits.join('');
  }

  _randomString(charsCount, alphabet) {
    var self = this;
    var digits = [];
    for (var i = 0; i < charsCount; i++) {
      digits[i] = self.choice(alphabet);
    }
    return digits.join('');
  }

  id(charsCount) {
    var self = this;
    // 17 characters is around 96 bits of entropy, which is the amount of
    // state in the Alea PRNG.
    if (charsCount === undefined) {
      charsCount = 17;
    }

    return self._randomString(charsCount, UNMISTAKABLE_CHARS);
  }

  secret(charsCount) {
    var self = this;
    // Default to 256 bits of entropy, or 43 characters at 6 bits per
    // character.
    if (charsCount === undefined) {
      charsCount = 43;
    }
    return self._randomString(charsCount, BASE64_CHARS);
  }

  choice(arrayOrString) {
    var index = Math.floor(this.fraction() * arrayOrString.length);
    if (typeof arrayOrString === 'string') {
      return arrayOrString.substr(index, 1);
    } else {
      return arrayOrString[index];
    }
  }

  static createWithSeed() {
    if (arguments.length === 0) {
      throw new Error('No seeds were provided');
    }
    return new Random(arguments);
  }
}

export default Random;
