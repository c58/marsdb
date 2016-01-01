/**
 * Based on Meteor's EJSON package.
 * Rewrite with ES6 and better formated for passing
 * linter
 */
import Base64 from './Base64';
import _some from 'fast.js/array/some';
import _check from 'check-types';
import _keys from 'fast.js/object/keys';
import _each from 'fast.js/forEach';


// Internal utils
function _isNaN(val) {
  return typeof val === 'number' && val != +val;
}
function _has(obj, key) {
  return _check.object(obj) && obj.hasOwnProperty(key);
}
function _isInfOrNan(val) {
  return _isNaN(val) || val === Infinity || val === -Infinity;
}
function _isArguments(val) {
  return (
    !!val && typeof val == 'object' &&
    Object.prototype.hasOwnProperty.call(val, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(val, 'callee')
  );
}


export class EJSON {
  // @ngInject
  constructor() {
    this._setupBuiltinConverters();
    this._customTypes = {};
  }

  /**
   * @summary Add a custom type, using a method of your choice to get to and
   * from a basic JSON-able representation.  The factory argument
   * is a function of JSON-able --> your object
   * The type you add must have:
   * - A toJSONValue() method, so that Meteor can serialize it
   * - a typeName() method, to show how to look it up in our type table.
   * It is okay if these methods are monkey-patched on.
   * EJSON.clone will use toJSONValue and the given factory to produce
   * a clone, but you may specify a method clone() that will be used instead.
   * Similarly, EJSON.equals will use toJSONValue to make comparisons,
   * but you may provide a method equals() instead.
   * @locus Anywhere
   * @param {String} name A tag for your custom type; must be unique among custom data types defined in your project, and must match the result of your type's `typeName` method.
   * @param {Function} factory A function that deserializes a JSON-compatible value into an instance of your type.  This should match the serialization performed by your type's `toJSONValue` method.
   */
  addType(name, factory) {
    if (_has(this._customTypes, name)) {
      throw new Error('Type ' + name + ' already present');
    }
    this._customTypes[name] = factory;
  }

  /**
   * @summary Serialize an EJSON-compatible value into its plain JSON representation.
   * @locus Anywhere
   * @param {EJSON} val A value to serialize to plain JSON.
   */
  toJSONValue(item) {
    var changed = this._toJSONValueHelper(item);
    if (changed !== undefined) {
      return changed;
    }
    if (typeof item === 'object') {
      item = this.clone(item);
      this._adjustTypesToJSONValue(item);
    }
    return item;
  }

  /**
   * @summary Deserialize an EJSON value from its plain JSON representation.
   * @locus Anywhere
   * @param {JSONCompatible} val A value to deserialize into EJSON.
   */
  fromJSONValue(item) {
    var changed = this._fromJSONValueHelper(item);
    if (changed === item && typeof item === 'object') {
      item = this.clone(item);
      this._adjustTypesFromJSONValue(item);
      return item;
    } else {
      return changed;
    }
  }

  /**
   * @summary Serialize a value to a string.
   * For EJSON values, the serialization fully represents the value. For non-EJSON values, serializes the same way as `JSON.stringify`.
   * @locus Anywhere
   * @param {EJSON} val A value to stringify.
   */
  stringify(item) {
    var json = this.toJSONValue(item);
    return JSON.stringify(json);
  }

  /**
   * @summary Parse a string into an EJSON value. Throws an error if the string is not valid EJSON.
   * @locus Anywhere
   * @param {String} str A string to parse into an EJSON value.
   */
  parse(item) {
    if (typeof item !== 'string') {
      throw new Error('EJSON.parse argument should be a string');
    }
    return this.fromJSONValue(JSON.parse(item));
  }

  /**
   * @summary Returns true if `x` is a buffer of binary data, as returned from [`EJSON.newBinary`](#ejson_new_binary).
   * @param {Object} x The variable to check.
   * @locus Anywhere
   */
  isBinary(obj) {
    return !!((typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array) ||
      (obj && obj.$Uint8ArrayPolyfill));
  }

  /**
   * @summary Return true if `a` and `b` are equal to each other.  Return false otherwise.  Uses the `equals` method on `a` if present, otherwise performs a deep comparison.
   * @locus Anywhere
   * @param {EJSON} a
   * @param {EJSON} b
   * @param {Object} [options]
   * @param {Boolean} options.keyOrderSensitive Compare in key sensitive order, if supported by the JavaScript implementation.  For example, `{a: 1, b: 2}` is equal to `{b: 2, a: 1}` only when `keyOrderSensitive` is `false`.  The default is `false`.
   */
  equals(a, b, options) {
    var i;
    var keyOrderSensitive = !!(options && options.keyOrderSensitive);
    if (a === b) {
      return true;
    }
    if (_isNaN(a) && _isNaN(b)) {
      return true; // This differs from the IEEE spec for NaN equality, b/c we don't want
                   // anything ever with a NaN to be poisoned from becoming equal to anything.
    }
    if (!a || !b) { // if either one is falsy, they'd have to be === to be equal
      return false;
    }
    if (!(typeof a === 'object' && typeof b === 'object')) {
      return false;
    }
    if (a instanceof Date && b instanceof Date) {
      return a.valueOf() === b.valueOf();
    }
    if (this.isBinary(a) && this.isBinary(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }
    if (typeof (a.equals) === 'function') {
      return a.equals(b, options);
    }
    if (typeof (b.equals) === 'function') {
      return b.equals(a, options);
    }
    if (a instanceof Array) {
      if (!(b instanceof Array)) {
        return false;
      }
      if (a.length !== b.length) {
        return false;
      }
      for (i = 0; i < a.length; i++) {
        if (!this.equals(a[i], b[i], options)) {
          return false;
        }
      }
      return true;
    }
    // fallback for custom types that don't implement their own equals
    switch (this._isCustomType(a) + this._isCustomType(b)) {
      case 1: return false;
      case 2: return this.equals(this.toJSONValue(a), this.toJSONValue(b));
    }
    // fall back to structural equality of objects
    var ret;
    if (keyOrderSensitive) {
      var bKeys = _keys(b);
      i = 0;
      ret = _keys(a).every((x) => {
        if (i >= bKeys.length) {
          return false;
        }
        if (x !== bKeys[i]) {
          return false;
        }
        if (!this.equals(a[x], b[bKeys[i]], options)) {
          return false;
        }
        i++;
        return true;
      });
      return ret && i === bKeys.length;
    } else {
      i = 0;
      ret = _keys(a).every((key) => {
        if (!_has(b, key)) {
          return false;
        }
        if (!this.equals(a[key], b[key], options)) {
          return false;
        }
        i++;
        return true;
      });
      return ret && _keys(b).length === i;
    }
  }

  /**
   * @summary Return a deep copy of `val`.
   * @locus Anywhere
   * @param {EJSON} val A value to copy.
   */
  clone(v) {
    var ret;
    if (typeof v !== 'object') {
      return v;
    }
    if (v === null) {
      return null; // null has typeof 'object'
    }
    if (v instanceof Date) {
      return new Date(v.getTime());
    }
    // RegExps are not really EJSON elements (eg we don't define a serialization
    // for them), but they're immutable anyway, so we can support them in clone.
    if (v instanceof RegExp) {
      return v;
    }
    if (this.isBinary(v)) {
      ret = Base64.newBinary(v.length);
      for (let i = 0; i < v.length; i++) {
        ret[i] = v[i];
      }
      return ret;
    }

    if (_check.array(v) || _isArguments(v)) {
      ret = [];
      for (let i = 0; i < v.length; i++) {
        ret[i] = this.clone(v[i]);
      }
      return ret;
    }
    // handle general user-defined typed Objects if they have a clone method
    if (typeof v.clone === 'function') {
      return v.clone();
    }
    // handle other custom types
    if (this._isCustomType(v)) {
      return this.fromJSONValue(this.clone(this.toJSONValue(v)), true);
    }
    // handle other objects
    ret = {};
    _each(v, (val, key) => {
      ret[key] = this.clone(val);
    });
    return ret;
  }

  newBinary(len) {
    return Base64.newBinary(len);
  }

  _setupBuiltinConverters() {
    this._builtinConverters = [
      { // Date
        matchJSONValue: (obj) => {
          return _has(obj, '$date') &&
            _keys(obj).length === 1;
        },
        matchObject: (obj) => {
          return obj instanceof Date;
        },
        toJSONValue: (obj) => {
          return {$date: obj.getTime()};
        },
        fromJSONValue: (obj) => {
          return new Date(obj.$date);
        },
      },
      { // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'
        // which we match.)
        matchJSONValue: (obj) => {
          return _has(obj, '$InfNaN') &&
            _keys(obj).length === 1;
        },
        matchObject: _isInfOrNan,
        toJSONValue: (obj) => {
          var sign;
          if (_isNaN(obj)) {
            sign = 0;
          } else if (obj === Infinity) {
            sign = 1;
          } else {
            sign = -1;
          }
          return {$InfNaN: sign};
        },
        fromJSONValue: (obj) => {
          return obj.$InfNaN/0;
        },
      },
      { // Binary
        matchJSONValue: (obj) => {
          return _has(obj, '$binary') &&
            _keys(obj).length === 1;
        },
        matchObject: (obj) => {
          return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array ||
            (obj && _has(obj, '$Uint8ArrayPolyfill'));
        },
        toJSONValue: (obj) => {
          return {$binary: Base64.encode(obj)};
        },
        fromJSONValue: (obj) => {
          return Base64.decode(obj.$binary);
        },
      },
      { // Escaping one level
        matchJSONValue: (obj) => {
          return _has(obj, '$escape') &&
            _keys(obj).length === 1;
        },
        matchObject: (obj) => {
          if (
            !_check.assigned(obj) || _check.emptyObject(obj) ||
            (_check.object(obj) && _keys(obj).length > 2)
          ) {
            return false;
          }
          return _some(this._builtinConverters, (converter) => {
            return converter.matchJSONValue(obj);
          });
        },
        toJSONValue: (obj) => {
          var newObj = {};
          _each(obj, (val, key) => {
            newObj[key] = this.toJSONValue(val);
          });
          return {$escape: newObj};
        },
        fromJSONValue: (obj) => {
          var newObj = {};
          _each(obj.$escape, (val, key) => {
            newObj[key] = this.fromJSONValue(val);
          });
          return newObj;
        },
      },
      { // Custom
        matchJSONValue: (obj) => {
          return _has(obj, '$type') &&
            _has(obj, '$value') &&
            _keys(obj).length === 2;
        },
        matchObject: (obj) => {
          return this._isCustomType(obj);
        },
        toJSONValue: (obj) => {
          var jsonValue = obj.toJSONValue();
          return {$type: obj.typeName(), $value: jsonValue};
        },
        fromJSONValue: (obj) => {
          var typeName = obj.$type;
          if (!_has(this._customTypes, typeName)) {
            throw new Error('Custom EJSON type ' + typeName + ' is not defined');
          }
          var converter = this._customTypes[typeName];
          return converter(obj.$value);
        },
      },
    ];
  }

  _isCustomType(obj) {
    return obj &&
      typeof obj.toJSONValue === 'function' &&
      typeof obj.typeName === 'function' &&
      _has(this._customTypes, obj.typeName());
  }

  /**
   * For both arrays and objects, in-place modification.
   */
  _adjustTypesToJSONValue(obj) {
    // Is it an atom that we need to adjust?
    if (obj === null) {
      return null;
    }
    var maybeChanged = this._toJSONValueHelper(obj);
    if (maybeChanged !== undefined) {
      return maybeChanged;
    }

    // Other atoms are unchanged.
    if (typeof obj !== 'object') {
      return obj;
    }

    // Iterate over array or object structure.
    _each(obj, (value, key) => {
      if (typeof value !== 'object' && value !== undefined &&
        !_isInfOrNan(value)) {
        return;
      }

      var changed = this._toJSONValueHelper(value);
      if (changed) {
        obj[key] = changed;
        return;
      }
      // if we get here, value is an object but not adjustable
      // at this level.  recurse.
      this._adjustTypesToJSONValue(value);
    });
    return obj;
  }

  /**
   * Either return the JSON-compatible version of the argument, or undefined
   * (if the item isn't itself replaceable, but maybe some fields in it are)
   */
  _toJSONValueHelper(item) {
    for (var i = 0; i < this._builtinConverters.length; i++) {
      var converter = this._builtinConverters[i];
      if (converter.matchObject(item)) {
        return converter.toJSONValue(item);
      }
    }
    return undefined;
  }

  /**
   * For both arrays and objects. Tries its best to just
   * use the object you hand it, but may return something
   * different if the object you hand it itself needs changing.
   */
  _adjustTypesFromJSONValue(obj) {
    if (obj === null) {
      return null;
    }
    var maybeChanged = this._fromJSONValueHelper(obj);
    if (maybeChanged !== obj) {
      return maybeChanged;
    }

    // Other atoms are unchanged.
    if (typeof obj !== 'object') {
      return obj;
    }

    _each(obj, (value, key) => {
      if (typeof value === 'object') {
        var changed = this._fromJSONValueHelper(value);
        if (value !== changed) {
          obj[key] = changed;
          return;
        }
        // if we get here, value is an object but not adjustable
        // at this level.  recurse.
        this._adjustTypesFromJSONValue(value);
      }
    });
    return obj;
  }

  /**
   * Either return the argument changed to have the non-json
   * rep of itself (the Object version) or the argument itself.
   * DOES NOT RECURSE.  For actually getting the fully-changed value,
   * use EJSON.fromJSONValue
   */
  _fromJSONValueHelper(value) {
    if (typeof value === 'object' && value !== null) {
      if (_keys(value).length <= 2 &&
          _keys(value).every(function(k) {
            return typeof k === 'string' && k.substr(0, 1) === '$';
          })) {
        for (var i = 0; i < this._builtinConverters.length; i++) {
          var converter = this._builtinConverters[i];
          if (converter.matchJSONValue(value)) {
            return converter.fromJSONValue(value);
          }
        }
      }
    }
    return value;
  }
}

export default new EJSON();
