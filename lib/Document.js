import _assign from 'lodash/object/assign';
import _isArray from 'lodash/lang/isArray';
import _isString from 'lodash/lang/isString';
import _each from 'lodash/collection/each';
import _size from 'lodash/collection/size';
import invariant from 'invariant';
import EJSON from './EJSON';


/*
 * Instance of a model (Document)
 * It delegates some useful methods to a given
 * collection object(`remove`, `update`).
 */
export function Document(db, raw = {}) {
  invariant(
    db,
    'Document(...): you must give a collection for the document'
  );

  // Ensure raw object
  raw = _isString(raw) ? EJSON.parse(raw) : raw;

  // Define internal methods
  Object.defineProperty(this, 'remove', {
    value: () => {
      invariant(
        this._id,
        'remove(...): document must have an _id for remove'
      );
      return db.remove({_id: self._id});
    },
    writable: false,
  });

  Object.defineProperty(this, 'update', {
    value: function(modifier) {
      invariant(
        this._id,
        'update(...): document must have an _id for update'
      );
      return db.update({_id: self._id}, modifier);
    },
    writable: false,
  });

  Object.defineProperty(this, 'copy', {
    value: () => new Document(db, EJSON.clone(this)),
    writable: false,
  });

  Object.defineProperty(this, 'serialize', {
    value: () => EJSON.stringify(this),
    writable: false,
  });

  // Special methods from collection
  for (const method in db._methods) {
    Object.defineProperty(this, method, {
      value: db._methods[method],
      writable: false,
    });
  }

  // Move given raw object to a Document
  _assign(this, raw);
}

export default Document;

/**
 * Return true if given selector is an
 * object id type (string or number)
 * @param  {Mixed} selector
 * @return {Boolean}
 */
export function selectorIsId(selector) {
  return (
    (typeof selector === 'string') ||
    (typeof selector === 'number')
  );
}

export function selectorIsIdPerhapsAsObject(selector) {
  return (
    selectorIsId(selector) ||
    (selector && typeof selector === 'object' &&
     selector._id && selectorIsId(selector._id) &&
     _size(selector) === 1)
  );
}

// Like _isArray, but doesn't regard polyfilled Uint8Arrays on old browsers as
// arrays.
// XXX maybe this should be EJSON.isArray
export function isArray(x) {
  return _isArray(x) && !EJSON.isBinary(x);
}

// XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
// RegExp
// XXX note that _type(undefined) === 3!!!!
export function isPlainObject(x) {
  return x && MongoTypeComp._type(x) === 3;
}

export function isIndexable(x) {
  return isArray(x) || isPlainObject(x);
}

// Returns true if this is an object with at least one key and all keys begin
// with $.  Unless inconsistentOK is set, throws if some keys begin with $ and
// others don't.
export function isOperatorObject(valueSelector, inconsistentOK) {
  if (!isPlainObject(valueSelector)) {
    return false;
  }

  var theseAreOperators = undefined;
  _each(valueSelector, function(value, selKey) {
    var thisIsOperator = selKey.substr(0, 1) === '$';
    if (theseAreOperators === undefined) {
      theseAreOperators = thisIsOperator;
    } else if (theseAreOperators !== thisIsOperator) {
      if (!inconsistentOK) {
        throw new Error('Inconsistent operator: ' +
                        JSON.stringify(valueSelector));
      }
      theseAreOperators = false;
    }
  });
  return !!theseAreOperators;  // {} has no operators
}


// string can be converted to integer
export function isNumericKey(s) {
  return /^[0-9]+$/.test(s);
}

// helpers used by compiled selector code
export const MongoTypeComp = {
  // XXX for _all and _in, consider building 'inquery' at compile time..

  _type: function(v) {
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
    } else if (EJSON.isBinary(v)) {
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
  _equal: function(a, b) {
    return EJSON.equals(a, b, {keyOrderSensitive: true});
  },

  // maps a type code to a value that can be used to sort values of
  // different types
  _typeorder: function(t) {
    // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
    // XXX what is the correct sort position for Javascript code?
    // ('100' in the matrix below)
    // XXX minkey/maxkey
    return [-1,  // (not a type)
            1,   // number
            2,   // string
            3,   // object
            4,   // array
            5,   // binary
            -1,  // deprecated
            6,   // ObjectID
            7,   // bool
            8,   // Date
            0,   // null
            9,   // RegExp
            -1,  // deprecated
            100, // JS code
            2,   // deprecated (symbol)
            100, // JS code
            1,   // 32-bit int
            8,   // Mongo timestamp
            1,   // 64-bit int
           ][t];
  },

  // compare two values of unknown type according to BSON ordering
  // semantics. (as an extension, consider 'undefined' to be less than
  // any other value.) return negative if a is less, positive if b is
  // less, or 0 if equal
  _cmp: function(a, b) {
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
    if (ta === 7) { // ObjectID
      // Convert to string.
      ta = tb = 2;
      a = a.toHexString();
      b = b.toHexString();
    }
    if (ta === 9) { // Date
      // Convert to millis.
      ta = tb = 1;
      a = a.getTime();
      b = b.getTime();
    }

    if (ta === 1) { // double
      return a - b;
    }
    if (tb === 2) { // string
      return a < b ? -1 : (a === b ? 0 : 1);
    }
    if (ta === 3) { // Object
      // this could be much more efficient in the expected case ...
      var to_array = function(obj) {
        var ret = [];
        for (var key in obj) {
          ret.push(key);
          ret.push(obj[key]);
        }
        return ret;
      };
      return MongoTypeComp._cmp(to_array(a), to_array(b));
    }
    if (ta === 4) { // Array
      for (var i = 0; ; i++) {
        if (i === a.length) {
          return (i === b.length) ? 0 : -1;
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
    if (ta === 5) { // binary
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
    if (ta === 8) { // boolean
      if (a) {
        return b ? 0 : 1;
      }
      return b ? -1 : 0;
    }
    if (ta === 10) { // null
      return 0;
    }
    if (ta === 11) { // regexp
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
    if (ta === 13) { // javascript code
      throw Error('Sorting not supported on Javascript code'); // XXX
    }
    throw Error('Unknown type to sort');
  },
};
