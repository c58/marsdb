'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findModTarget = exports.DocumentModifier = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _assign2 = require('fast.js/object/assign');

var _assign3 = _interopRequireDefault(_assign2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _every2 = require('fast.js/array/every');

var _every3 = _interopRequireDefault(_every2);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

var _Random = require('./Random');

var _Random2 = _interopRequireDefault(_Random);

var _DocumentMatcher = require('./DocumentMatcher');

var _DocumentMatcher2 = _interopRequireDefault(_DocumentMatcher);

var _DocumentSorter = require('./DocumentSorter');

var _DocumentSorter2 = _interopRequireDefault(_DocumentSorter);

var _Document = require('./Document');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DocumentModifier = exports.DocumentModifier = function () {
  function DocumentModifier() {
    var query = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, DocumentModifier);

    this._query = query;
    this._matcher = new _DocumentMatcher2.default(query);
  }

  _createClass(DocumentModifier, [{
    key: 'modify',
    value: function modify(docs) {
      var _this = this;

      var mod = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var oldResults = [];
      var newResults = [];

      // Regular update
      (0, _forEach2.default)(docs, function (d) {
        var match = _this._matcher.documentMatches(d);
        if (match.result) {
          var matchOpts = (0, _assign3.default)({ arrayIndices: match.arrayIndices }, options);
          var newDoc = _this._modifyDocument(d, mod, matchOpts);
          newResults.push(newDoc);
          oldResults.push(d);
        }
      });

      // Upsert update
      if (!newResults.length && options.upsert) {
        var newDoc = documentBySelector(this._query);
        newDoc._id = newDoc._id || _Random2.default.default().id(17);
        newDoc = this._modifyDocument(newDoc, mod, { isInsert: true });
        newResults.push(newDoc);
        oldResults.push(null);
      }

      return {
        updated: newResults,
        original: oldResults
      };
    }

    // XXX need a strategy for passing the binding of $ into this
    // function, from the compiled selector
    //
    // maybe just {key.up.to.just.before.dollarsign: array_index}
    //
    // XXX atomicity: if one modification fails, do we roll back the whole
    // change?
    //
    // options:
    //   - isInsert is set when _modify is being called to compute the document to
    //     insert as part of an upsert operation. We use this primarily to figure
    //     out when to set the fields in $setOnInsert, if present.

  }, {
    key: '_modifyDocument',
    value: function _modifyDocument(doc, mod) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      if (!(0, _Document.isPlainObject)(mod)) {
        throw new Error('Modifier must be an object');
      }

      // Make sure the caller can't mutate our data structures.
      mod = _EJSON2.default.clone(mod);
      var isModifier = (0, _Document.isOperatorObject)(mod);
      var newDoc;

      if (!isModifier) {
        if (!options.isInsert && mod._id && !_EJSON2.default.equals(doc._id, mod._id)) {
          throw new Error('Cannot change the _id of a document');
        }

        // replace the whole document
        for (var k in mod) {
          if (/\./.test(k)) {
            throw new Error('When replacing document, field name may not contain \'.\'');
          }
        }
        newDoc = mod;
        newDoc._id = doc._id;
      } else {
        // apply modifiers to the doc.
        newDoc = _EJSON2.default.clone(doc);

        (0, _forEach2.default)(mod, function (operand, op) {
          var modFunc = MODIFIERS[op];
          // Treat $setOnInsert as $set if this is an insert.
          if (options.isInsert && op === '$setOnInsert') {
            modFunc = MODIFIERS.$set;
          }
          if (!modFunc) {
            throw new Error('Invalid modifier specified ' + op);
          }
          (0, _forEach2.default)(operand, function (arg, keypath) {
            if (keypath === '') {
              throw new Error('An empty update path is not valid.');
            }
            if (keypath === '_id' && !options.isInsert) {
              throw new Error('Mod on _id not allowed for update.');
            }

            var keyparts = keypath.split('.');

            if (!(0, _every3.default)(keyparts, function (x) {
              return x;
            })) {
              throw new Error('The update path \'' + keypath + '\' contains an empty field name, which is not allowed.');
            }

            var target = findModTarget(newDoc, keyparts, {
              noCreate: NO_CREATE_MODIFIERS[op],
              forbidArray: op === '$rename',
              arrayIndices: options.arrayIndices
            });
            var field = keyparts.pop();
            modFunc(target, field, arg, keypath, newDoc);
          });
        });
      }

      return newDoc;
    }
  }]);

  return DocumentModifier;
}();

exports.default = DocumentModifier;

// by given selector returns an object that should
// be used for upsert operation

var documentBySelector = function documentBySelector(selector) {
  var selectorDoc = {};

  if (!_checkTypes2.default.object(selector)) {
    selector = { _id: selector };
  }

  (0, _forEach2.default)(selector, function (v, k) {
    if (k.substr(0, 1) !== '$' && !(0, _Document.isOperatorObject)(v, true)) {
      var keyparts = k.split('.');
      var modTarget = findModTarget(selectorDoc, keyparts);
      if (modTarget) {
        modTarget[keyparts[keyparts.length - 1]] = v;
      }
    }
  });

  return selectorDoc;
};

// for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
// and then you would operate on the 'e' property of the returned
// object.
//
// if options.noCreate is falsey, creates intermediate levels of
// structure as necessary, like mkdir -p (and raises an exception if
// that would mean giving a non-numeric property to an array.) if
// options.noCreate is true, return undefined instead.
//
// may modify the last element of keyparts to signal to the caller that it needs
// to use a different value to index into the returned object (for example,
// ['a', '01'] -> ['a', 1]).
//
// if forbidArray is true, return null if the keypath goes through an array.
//
// if options.arrayIndices is set, use its first element for the (first) '$' in
// the path.
var findModTarget = exports.findModTarget = function findModTarget(doc, keyparts, options) {
  options = options || {};
  var usedArrayIndex = false;
  for (var i = 0; i < keyparts.length; i++) {
    var last = i === keyparts.length - 1;
    var keypart = keyparts[i];
    var indexable = (0, _Document.isIndexable)(doc);
    if (!indexable) {
      if (options.noCreate) {
        return undefined;
      }
      var e = new Error('cannot use the part \'' + keypart + '\' to traverse ' + doc);
      e.setPropertyError = true;
      throw e;
    }
    if (doc instanceof Array) {
      if (options.forbidArray) {
        return null;
      }
      if (keypart === '$') {
        if (usedArrayIndex) {
          throw new Error('Too many positional (i.e. \'$\') elements');
        }
        if (!options.arrayIndices || !options.arrayIndices.length) {
          throw new Error('The positional operator did not find the ' + 'match needed from the query');
        }
        keypart = options.arrayIndices[0];
        usedArrayIndex = true;
      } else if ((0, _Document.isNumericKey)(keypart)) {
        keypart = parseInt(keypart, 10);
      } else {
        if (options.noCreate) {
          return undefined;
        }
        throw new Error('can\'t append to array using string field name [' + keypart + ']');
      }
      if (last) {
        // handle 'a.01'
        keyparts[i] = keypart;
      }
      if (options.noCreate && keypart >= doc.length) {
        return undefined;
      }
      while (doc.length < keypart) {
        doc.push(null);
      }
      if (!last) {
        if (doc.length === keypart) {
          doc.push({});
        } else if (_typeof(doc[keypart]) !== 'object') {
          throw new Error('can\'t modify field \'' + keyparts[i + 1] + '\' of list value ' + JSON.stringify(doc[keypart]));
        }
      }
    } else {
      if (keypart.length && keypart.substr(0, 1) === '$') {
        throw new Error('can\'t set field named ' + keypart);
      }
      if (!(keypart in doc)) {
        if (options.noCreate) {
          return undefined;
        }
        if (!last) {
          doc[keypart] = {};
        }
      }
    }

    if (last) {
      return doc;
    }
    doc = doc[keypart];
  }

  // notreached
};

var NO_CREATE_MODIFIERS = {
  $unset: true,
  $pop: true,
  $rename: true,
  $pull: true,
  $pullAll: true
};

var MODIFIERS = {
  $inc: function $inc(target, field, arg) {
    if (typeof arg !== 'number') {
      throw new Error('Modifier $inc allowed for numbers only');
    }
    if (field in target) {
      if (typeof target[field] !== 'number') {
        throw new Error('Cannot apply $inc modifier to non-number');
      }
      target[field] += arg;
    } else {
      target[field] = arg;
    }
  },
  $set: function $set(target, field, arg) {
    if (!_checkTypes2.default.object(target) && !_checkTypes2.default.array(target)) {
      var e = new Error('Cannot set property on non-object field');
      e.setPropertyError = true;
      throw e;
    }
    if (target === null) {
      var e = new Error('Cannot set property on null');
      e.setPropertyError = true;
      throw e;
    }
    target[field] = arg;
  },
  $setOnInsert: function $setOnInsert(target, field, arg) {
    // converted to `$set` in `_modify`
  },
  $unset: function $unset(target, field, arg) {
    if (target !== undefined) {
      if (target instanceof Array) {
        if (field in target) {
          target[field] = null;
        }
      } else {
        delete target[field];
      }
    }
  },
  $push: function $push(target, field, arg) {
    if (target[field] === undefined) {
      target[field] = [];
    }
    if (!(target[field] instanceof Array)) {
      throw new Error('Cannot apply $push modifier to non-array');
    }

    if (!(arg && arg.$each)) {
      // Simple mode: not $each
      target[field].push(arg);
      return;
    }

    // Fancy mode: $each (and maybe $slice and $sort and $position)
    var toPush = arg.$each;
    if (!(toPush instanceof Array)) {
      throw new Error('$each must be an array');
    }

    // Parse $position
    var position = undefined;
    if ('$position' in arg) {
      if (typeof arg.$position !== 'number') {
        throw new Error('$position must be a numeric value');
      }
      // XXX should check to make sure integer
      if (arg.$position < 0) {
        throw new Error('$position in $push must be zero or positive');
      }
      position = arg.$position;
    }

    // Parse $slice.
    var slice = undefined;
    if ('$slice' in arg) {
      if (typeof arg.$slice !== 'number') {
        throw new Error('$slice must be a numeric value');
      }
      // XXX should check to make sure integer
      if (arg.$slice > 0) {
        throw new Error('$slice in $push must be zero or negative');
      }
      slice = arg.$slice;
    }

    // Parse $sort.
    var sortFunction = undefined;
    if (arg.$sort) {
      if (slice === undefined) {
        throw new Error('$sort requires $slice to be present');
      }
      // XXX this allows us to use a $sort whose value is an array, but that's
      // actually an extension of the Node driver, so it won't work
      // server-side. Could be confusing!
      // XXX is it correct that we don't do geo-stuff here?
      sortFunction = new _DocumentSorter2.default(arg.$sort).getComparator();
      for (var i = 0; i < toPush.length; i++) {
        if (_Document.MongoTypeComp._type(toPush[i]) !== 3) {
          throw new Error('$push like modifiers using $sort ' + 'require all elements to be objects');
        }
      }
    }

    // Actually push.
    if (position === undefined) {
      for (var j = 0; j < toPush.length; j++) {
        target[field].push(toPush[j]);
      }
    } else {
      var spliceArguments = [position, 0];
      for (var j = 0; j < toPush.length; j++) {
        spliceArguments.push(toPush[j]);
      }
      Array.prototype.splice.apply(target[field], spliceArguments);
    }

    // Actually sort.
    if (sortFunction) {
      target[field].sort(sortFunction);
    }

    // Actually slice.
    if (slice !== undefined) {
      if (slice === 0) {
        target[field] = []; // differs from Array.slice!
      } else {
          target[field] = target[field].slice(slice);
        }
    }
  },
  $pushAll: function $pushAll(target, field, arg) {
    if (!((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object' && arg instanceof Array)) {
      throw new Error('Modifier $pushAll/pullAll allowed for arrays only');
    }
    var x = target[field];
    if (x === undefined) {
      target[field] = arg;
    } else if (!(x instanceof Array)) {
      throw new Error('Cannot apply $pushAll modifier to non-array');
    } else {
      for (var i = 0; i < arg.length; i++) {
        x.push(arg[i]);
      }
    }
  },
  $addToSet: function $addToSet(target, field, arg) {
    var isEach = false;
    if ((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object') {
      //check if first key is '$each'
      for (var k in arg) {
        if (k === '$each') {
          isEach = true;
        }
        break;
      }
    }
    var values = isEach ? arg.$each : [arg];
    var x = target[field];
    if (x === undefined) {
      target[field] = values;
    } else if (!(x instanceof Array)) {
      throw new Error('Cannot apply $addToSet modifier to non-array');
    } else {
      (0, _forEach2.default)(values, function (value) {
        for (var i = 0; i < x.length; i++) {
          if (_Document.MongoTypeComp._equal(value, x[i])) {
            return;
          }
        }
        x.push(value);
      });
    }
  },
  $pop: function $pop(target, field, arg) {
    if (target === undefined) {
      return;
    }
    var x = target[field];
    if (x === undefined) {
      return;
    } else if (!(x instanceof Array)) {
      throw new Error('Cannot apply $pop modifier to non-array');
    } else {
      if (typeof arg === 'number' && arg < 0) {
        x.splice(0, 1);
      } else {
        x.pop();
      }
    }
  },
  $pull: function $pull(target, field, arg) {
    if (target === undefined) {
      return;
    }
    var x = target[field];
    if (x === undefined) {
      return;
    } else if (!(x instanceof Array)) {
      throw new Error('Cannot apply $pull/pullAll modifier to non-array');
    } else {
      var out = [];
      if (arg != null && (typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object' && !(arg instanceof Array)) {
        // XXX would be much nicer to compile this once, rather than
        // for each document we modify.. but usually we're not
        // modifying that many documents, so we'll let it slide for
        // now

        // XXX Minimongo.Matcher isn't up for the job, because we need
        // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
        // like {$gt: 4} is not normally a complete selector.
        // same issue as $elemMatch possibly?
        var matcher = new _DocumentMatcher2.default(arg);
        for (var i = 0; i < x.length; i++) {
          if (!matcher.documentMatches(x[i]).result) {
            out.push(x[i]);
          }
        }
      } else {
        for (var i = 0; i < x.length; i++) {
          if (!_Document.MongoTypeComp._equal(x[i], arg)) {
            out.push(x[i]);
          }
        }
      }
      target[field] = out;
    }
  },
  $pullAll: function $pullAll(target, field, arg) {
    if (!((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object' && arg instanceof Array)) {
      throw new Error('Modifier $pushAll/pullAll allowed for arrays only');
    }
    if (target === undefined) {
      return;
    }
    var x = target[field];
    if (x === undefined) {
      return;
    } else if (!(x instanceof Array)) {
      throw new Error('Cannot apply $pull/pullAll modifier to non-array');
    } else {
      var out = [];
      for (var i = 0; i < x.length; i++) {
        var exclude = false;
        for (var j = 0; j < arg.length; j++) {
          if (_Document.MongoTypeComp._equal(x[i], arg[j])) {
            exclude = true;
            break;
          }
        }
        if (!exclude) {
          out.push(x[i]);
        }
      }
      target[field] = out;
    }
  },
  $rename: function $rename(target, field, arg, keypath, doc) {
    if (keypath === arg) {
      // no idea why mongo has this restriction..
      throw new Error('$rename source must differ from target');
    }
    if (target === null) {
      throw new Error('$rename source field invalid');
    }
    if (typeof arg !== 'string') {
      throw new Error('$rename target must be a string');
    }
    if (target === undefined) {
      return;
    }
    var v = target[field];
    delete target[field];

    var keyparts = arg.split('.');
    var target2 = findModTarget(doc, keyparts, { forbidArray: true });
    if (target2 === null) {
      throw new Error('$rename target field invalid');
    }
    var field2 = keyparts.pop();
    target2[field2] = v;
  },
  $bit: function $bit(target, field, arg) {
    // XXX mongo only supports $bit on integers, and we only support
    // native javascript numbers (doubles) so far, so we can't support $bit
    throw new Error('$bit is not supported');
  }
};