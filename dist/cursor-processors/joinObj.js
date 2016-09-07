'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.joinObj = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

var _reduce2 = require('fast.js/array/reduce');

var _reduce3 = _interopRequireDefault(_reduce2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _Collection = require('../Collection');

var _Collection2 = _interopRequireDefault(_Collection);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _joinAll = require('./joinAll');

var _DocumentModifier = require('../DocumentModifier');

var _DocumentMatcher = require('../DocumentMatcher');

var _Document = require('../Document');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * By given list of documents make mapping of joined
 * model ids to root document and vise versa.
 * @param  {Array}  docs
 * @param  {String} key
 * @return {Object}
 */
function _decomposeDocuments(docs, key) {
  var lookupFn = (0, _DocumentMatcher.makeLookupFunction)(key);
  var allIds = [];

  var docsWrapped = (0, _map3.default)(docs, function (d) {
    var val = lookupFn(d);
    var joinIds = (0, _filter3.default)((0, _reduce3.default)((0, _map3.default)(val, function (x) {
      return x.value;
    }), function (a, b) {
      if (_checkTypes2.default.array(b)) {
        return [].concat(_toConsumableArray(a), _toConsumableArray(b));
      } else {
        return [].concat(_toConsumableArray(a), [b]);
      }
    }, []), function (x) {
      return (0, _Document.selectorIsId)(x);
    });

    allIds = allIds.concat(joinIds);
    return {
      doc: d,
      lookupResult: val
    };
  });

  return { allIds: allIds, docsWrapped: docsWrapped };
}

/**
 * By given value of some key in join object return
 * an options object.
 * @param  {Object|Collection} joinValue
 * @return {Object}
 */
function _getJoinOptions(key, value) {
  if (value instanceof _Collection2.default) {
    return { model: value, joinPath: key };
  } else if (_checkTypes2.default.object(value)) {
    return {
      model: value.model,
      joinPath: value.joinPath || key
    };
  } else {
    throw new Error('Invalid join object value');
  }
}

/**
 * By given result of joining objects restriving and root documents
 * decomposition set joining object on each root document
 * (if it is exists).
 * @param  {String} joinPath
 * @param  {Array}  res
 * @param  {Object} docsById
 * @param  {Object} childToRootMap
 */
function _joinDocsWithResult(joinPath, res, docsWrapped) {
  var resIdMap = {};
  var initKeyparts = joinPath.split('.');

  (0, _forEach2.default)(res, function (v) {
    return resIdMap[v._id] = v;
  });
  (0, _forEach2.default)(docsWrapped, function (wrap) {
    (0, _forEach2.default)(wrap.lookupResult, function (branch) {
      if (branch.value) {
        // `findModTarget` will modify `keyparts`. So, it should
        // be copied each time.
        var keyparts = initKeyparts.slice();
        var target = (0, _DocumentModifier.findModTarget)(wrap.doc, keyparts, {
          noCreate: false,
          forbidArray: false,
          arrayIndices: branch.arrayIndices
        });
        var field = keyparts[keyparts.length - 1];

        if (_checkTypes2.default.array(branch.value)) {
          target[field] = (0, _map3.default)(branch.value, function (id) {
            return resIdMap[id];
          });
        } else {
          target[field] = resIdMap[branch.value] || null;
        }
      }
    });
  });
}

var joinObj = exports.joinObj = {
  method: function method(obj) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    (0, _invariant2.default)(_checkTypes2.default.object(obj), 'joinObj(...): argument must be an object');

    this._addPipeline('joinObj', obj, options);
    return this;
  },

  process: function process(docs, pipeObj, cursor) {
    if (!docs) {
      return Promise.resolve(docs);
    } else {
      var _ret = function () {
        var obj = pipeObj.value;
        var options = pipeObj.args[0] || {};
        var isObj = !_checkTypes2.default.array(docs);
        docs = !isObj ? docs : [docs];

        var joinerFn = function joinerFn(dcs) {
          return (0, _map3.default)((0, _keys3.default)(obj), function (k) {
            var _getJoinOptions2 = _getJoinOptions(k, obj[k]);

            var model = _getJoinOptions2.model;
            var joinPath = _getJoinOptions2.joinPath;

            var _decomposeDocuments2 = _decomposeDocuments(docs, k);

            var allIds = _decomposeDocuments2.allIds;
            var docsWrapped = _decomposeDocuments2.docsWrapped;

            var execFnName = options.observe ? 'observe' : 'then';
            return model.find({ _id: { $in: allIds } })[execFnName](function (res) {
              _joinDocsWithResult(joinPath, res, docsWrapped);
            });
          });
        };

        var newPipeObj = _extends({}, pipeObj, { value: joinerFn });
        return {
          v: _joinAll.joinAll.process(docs, newPipeObj, cursor).then(function (res) {
            return isObj ? res[0] : res;
          })
        };
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }
  }
};