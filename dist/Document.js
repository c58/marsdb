'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.Document = Document;
exports.selectorIsId = selectorIsId;
exports.selectorIsIdPerhapsAsObject = selectorIsIdPerhapsAsObject;
exports.isArray = isArray;
exports.isPlainObject = isPlainObject;
exports.isIndexable = isIndexable;
exports.isOperatorObject = isOperatorObject;
exports.isNumericKey = isNumericKey;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodashObjectAssign = require('lodash/object/assign');

var _lodashObjectAssign2 = _interopRequireDefault(_lodashObjectAssign);

var _lodashLangIsArray = require('lodash/lang/isArray');

var _lodashLangIsArray2 = _interopRequireDefault(_lodashLangIsArray);

var _lodashLangIsString = require('lodash/lang/isString');

var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

var _lodashCollectionEach = require('lodash/collection/each');

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _lodashCollectionSize = require('lodash/collection/size');

var _lodashCollectionSize2 = _interopRequireDefault(_lodashCollectionSize);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

/*
 * Instance of a model (Document)
 * It delegates some useful methods to a given
 * collection object(`remove`, `update`).
 */

function Document(db) {
  var _this = this;

  var raw = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  (0, _invariant2['default'])(db, 'Document(...): you must give a collection for the document');

  // Ensure raw object
  raw = (0, _lodashLangIsString2['default'])(raw) ? _EJSON2['default'].parse(raw) : raw;

  // Define internal methods
  Object.defineProperty(this, 'remove', {
    value: function () {
      (0, _invariant2['default'])(_this._id, 'remove(...): document must have an _id for remove');
      return db.remove({ _id: self._id });
    },
    writable: false
  });

  Object.defineProperty(this, 'update', {
    value: function (modifier) {
      (0, _invariant2['default'])(this._id, 'update(...): document must have an _id for update');
      return db.update({ _id: self._id }, modifier);
    },
    writable: false
  });

  Object.defineProperty(this, 'copy', {
    value: function () {
      return new Document(db, _EJSON2['default'].clone(_this));
    },
    writable: false
  });

  Object.defineProperty(this, 'serialize', {
    value: function () {
      return _EJSON2['default'].stringify(_this);
    },
    writable: false
  });

  // Special methods from collection
  for (var method in db._methods) {
    Object.defineProperty(this, method, {
      value: db._methods[method],
      writable: false
    });
  }

  // Move given raw object to a Document
  (0, _lodashObjectAssign2['default'])(this, raw);
}

exports['default'] = Document;

/**
 * Return true if given selector is an
 * object id type (string or number)
 * @param  {Mixed} selector
 * @return {Boolean}
 */

function selectorIsId(selector) {
  return typeof selector === 'string' || typeof selector === 'number';
}

function selectorIsIdPerhapsAsObject(selector) {
  return selectorIsId(selector) || selector && typeof selector === 'object' && selector._id && selectorIsId(selector._id) && (0, _lodashCollectionSize2['default'])(selector) === 1;
}

// Like _isArray, but doesn't regard polyfilled Uint8Arrays on old browsers as
// arrays.
// XXX maybe this should be EJSON.isArray

function isArray(x) {
  return (0, _lodashLangIsArray2['default'])(x) && !_EJSON2['default'].isBinary(x);
}

// XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
// RegExp
// XXX note that _type(undefined) === 3!!!!

function isPlainObject(x) {
  return x && MongoTypeComp._type(x) === 3;
}

function isIndexable(x) {
  return isArray(x) || isPlainObject(x);
}

// Returns true if this is an object with at least one key and all keys begin
// with $.  Unless inconsistentOK is set, throws if some keys begin with $ and
// others don't.

function isOperatorObject(valueSelector, inconsistentOK) {
  if (!isPlainObject(valueSelector)) {
    return false;
  }

  var theseAreOperators = undefined;
  (0, _lodashCollectionEach2['default'])(valueSelector, function (value, selKey) {
    var thisIsOperator = selKey.substr(0, 1) === '$';
    if (theseAreOperators === undefined) {
      theseAreOperators = thisIsOperator;
    } else if (theseAreOperators !== thisIsOperator) {
      if (!inconsistentOK) {
        throw new Error('Inconsistent operator: ' + JSON.stringify(valueSelector));
      }
      theseAreOperators = false;
    }
  });
  return !!theseAreOperators; // {} has no operators
}

// string can be converted to integer

function isNumericKey(s) {
  return (/^[0-9]+$/.test(s)
  );
}

// helpers used by compiled selector code
var MongoTypeComp = {
  // XXX for _all and _in, consider building 'inquery' at compile time..

  _type: function (v) {
    if (typeof v === 'number') {
      return 1;
    } else if (typeof v === 'string') {
      return 2;
    } else if (typeof v === 'boolean') {
      return 8;
    } else if (isArray(v)) {
      return 4;
    } else if (v === null) {
      return 10;
    } else if (v instanceof RegExp) {
      // note that typeof(/x/) === 'object'
      return 11;
    } else if (typeof v === 'function') {
      return 13;
    } else if (v instanceof Date) {
      return 9;
    } else if (_EJSON2['default'].isBinary(v)) {
      return 5;
    }
    return 3; // object

    // XXX support some/all of these:
    // 14, symbol
    // 15, javascript code with scope
    // 16, 18: 32-bit/64-bit integer
    // 17, timestamp
    // 255, minkey
    // 127, maxkey
  },

  // deep equality test: use for literal document and array matches
  _equal: function (a, b) {
    return _EJSON2['default'].equals(a, b, { keyOrderSensitive: true });
  },

  // maps a type code to a value that can be used to sort values of
  // different types
  _typeorder: function (t) {
    // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
    // XXX what is the correct sort position for Javascript code?
    // ('100' in the matrix below)
    // XXX minkey/maxkey
    return [-1, // (not a type)
    1, // number
    2, // string
    3, // object
    4, // array
    5, // binary
    -1, // deprecated
    6, // ObjectID
    7, // bool
    8, // Date
    0, // null
    9, // RegExp
    -1, // deprecated
    100, // JS code
    2, // deprecated (symbol)
    100, // JS code
    1, // 32-bit int
    8, // Mongo timestamp
    1][// 64-bit int
    t];
  },

  // compare two values of unknown type according to BSON ordering
  // semantics. (as an extension, consider 'undefined' to be less than
  // any other value.) return negative if a is less, positive if b is
  // less, or 0 if equal
  _cmp: function (a, b) {
    if (a === undefined) {
      return b === undefined ? 0 : -1;
    }
    if (b === undefined) {
      return 1;
    }
    var ta = MongoTypeComp._type(a);
    var tb = MongoTypeComp._type(b);
    var oa = MongoTypeComp._typeorder(ta);
    var ob = MongoTypeComp._typeorder(tb);
    if (oa !== ob) {
      return oa < ob ? -1 : 1;
    }
    if (ta !== tb) {
      // XXX need to implement this if we implement Symbol or integers, or
      // Timestamp
      throw Error('Missing type coercion logic in _cmp');
    }
    if (ta === 7) {
      // ObjectID
      // Convert to string.
      ta = tb = 2;
      a = a.toHexString();
      b = b.toHexString();
    }
    if (ta === 9) {
      // Date
      // Convert to millis.
      ta = tb = 1;
      a = a.getTime();
      b = b.getTime();
    }

    if (ta === 1) {
      // double
      return a - b;
    }
    if (tb === 2) {
      // string
      return a < b ? -1 : a === b ? 0 : 1;
    }
    if (ta === 3) {
      // Object
      // this could be much more efficient in the expected case ...
      var to_array = function (obj) {
        var ret = [];
        for (var key in obj) {
          ret.push(key);
          ret.push(obj[key]);
        }
        return ret;
      };
      return MongoTypeComp._cmp(to_array(a), to_array(b));
    }
    if (ta === 4) {
      // Array
      for (var i = 0;; i++) {
        if (i === a.length) {
          return i === b.length ? 0 : -1;
        }
        if (i === b.length) {
          return 1;
        }
        var s = MongoTypeComp._cmp(a[i], b[i]);
        if (s !== 0) {
          return s;
        }
      }
    }
    if (ta === 5) {
      // binary
      // Surprisingly, a small binary blob is always less than a large one in
      // Mongo.
      if (a.length !== b.length) {
        return a.length - b.length;
      }
      for (i = 0; i < a.length; i++) {
        if (a[i] < b[i]) {
          return -1;
        }
        if (a[i] > b[i]) {
          return 1;
        }
      }
      return 0;
    }
    if (ta === 8) {
      // boolean
      if (a) {
        return b ? 0 : 1;
      }
      return b ? -1 : 0;
    }
    if (ta === 10) {
      // null
      return 0;
    }
    if (ta === 11) {
      // regexp
      throw Error('Sorting not supported on regular expression'); // XXX
    }
    // 13: javascript code
    // 14: symbol
    // 15: javascript code with scope
    // 16: 32-bit integer
    // 17: timestamp
    // 18: 64-bit integer
    // 255: minkey
    // 127: maxkey
    if (ta === 13) {
      // javascript code
      throw Error('Sorting not supported on Javascript code'); // XXX
    }
    throw Error('Unknown type to sort');
  }
};
exports.MongoTypeComp = MongoTypeComp;