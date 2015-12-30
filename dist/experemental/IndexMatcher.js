'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _QUERY_LOGIC_OPS_IMPL, _QUERY_COMP_OPS_IMPL;

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IndexMatcher = undefined;
exports._getIntersection = _getIntersection;
exports._getIncludeIntersection = _getIncludeIntersection;
exports._getExcludeIntersection = _getExcludeIntersection;
exports._getUnion = _getUnion;
exports._makeMatchResult = _makeMatchResult;
exports._normilizeQuery = _normilizeQuery;

var _keys2 = require('lodash/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _each2 = require('lodash/collection/each');

var _each3 = _interopRequireDefault(_each2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _Document = require('./Document');

var _flattenArray = require('flattenArray');

var _flattenArray2 = _interopRequireDefault(_flattenArray);

var _isEmpty = require('isEmpty');

var _isEmpty2 = _interopRequireDefault(_isEmpty);

var _Utils = require('./Utils');

var _Utils2 = _interopRequireDefault(_Utils);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Internal utils
// Exported for testing
function _getIntersection(include, arrs) {
  var sets = arrs.filter(function (x) {
    return x;
  }).map(function (x) {
    return new Set(x);
  });
  var result = new Set();

  if (!sets.length) {
    return [];
  }

  (0, _each3.default)(sets[0], function (v) {
    var isResValue = true;
    for (var i = 1; i < sets.length; i++) {
      isResValue = sets[i].has(v);
      isResValue = include ? isResValue : !isResValue;
      if (!isResValue) {
        return false;
      }
    }
    if (isResValue) {
      result.add(v);
    }
  });

  return Array.from(result);
}

function _getIncludeIntersection(arrs) {
  return _getIntersection(true, arrs);
}

function _getExcludeIntersection(arrs) {
  return _getIntersection(false, arrs);
}

function _getUnion() {
  for (var _len = arguments.length, arrs = Array(_len), _key = 0; _key < _len; _key++) {
    arrs[_key] = arguments[_key];
  }

  return Array.from(new Set((0, _flattenArray2.default)(arrs)));
}

function _makeMatchResult() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var basic = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (options.include) {
    basic.include = basic.include || [];
    Array.prototype.push.apply(basic.include, options.include);
  }
  if (options.exclude) {
    basic.exclude = basic.exclude || [];
    Array.prototype.push.apply(basic.exclude, options.exclude);
  }
  return basic;
}

function _normilizeQuery(query) {
  if (query === undefined || query === null) {
    return { _id: { $exists: false } };
  } else if (!_Utils2.default.isObject(query)) {
    return { _id: query };
  } else if ((0, _isEmpty2.default)(query)) {
    return { _id: { $exists: true } };
  }
  return query;
}

// Query parts implementation
var QUERY_LOGIC_OPS_IMPL = (_QUERY_LOGIC_OPS_IMPL = {}, _defineProperty(_QUERY_LOGIC_OPS_IMPL, _Document.QUERY_OPS.$and, function (retriver, key, value) {
  (0, _invariant2.default)(_Utils2.default.isArray(value), '$and(...): argument must be an array');

  var matchPromises = value.map(function (q) {
    return retriver.execQuery(q);
  });
  return Promise.all(matchPromises).then(function (matches) {
    var result = _getIncludeIntersection(matches);
    return _makeMatchResult({ include: result });
  });
}), _defineProperty(_QUERY_LOGIC_OPS_IMPL, _Document.QUERY_OPS.$or, function (retriver, key, value) {
  (0, _invariant2.default)(_Utils2.default.isArray(value), '$or(...): argument must be an array');

  var matchPromises = value.map(function (q) {
    return retriver.execQuery(q);
  });
  return Promise.all(matchPromises).then(function (matches) {
    var result = _getUnion(matches);
    return _makeMatchResult({ include: result });
  });
}), _QUERY_LOGIC_OPS_IMPL);

var QUERY_COMP_OPS_IMPL = (_QUERY_COMP_OPS_IMPL = {}, _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$in, function (index, value, basic, query) {
  (0, _invariant2.default)(_Utils2.default.isArray(value), '$in(...): argument must be an array');
  _makeMatchResult({ include: index.getMatching(value) }, basic);
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$options, function () {}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$regex, function (index, value, basic, query) {
  (0, _invariant2.default)(value instanceof RegExp || typeof value === 'string', '$regex(...): argument must be a RegExp or string');

  var regex = _Utils2.default.ensureRegExp(value, query.$options);
  var matcher = function matcher(v) {
    return v.key && regex.test(v.key);
  };
  _makeMatchResult({ include: index.getAll({ matcher: matcher }) }, basic);
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$exists, function (index, value, basic, query) {
  var withoutField = new Set();
  var withField = new Set();
  index.getAll({ matcher: function matcher(v) {
      if (v.key === undefined) {
        withoutField.add(v.value);
      } else {
        withField.add(v.value);
      }
    } });

  value = !!(value || value === '');
  var result = value ? { include: Array.from(withField) } : { include: _getExcludeIntersection([withoutField, withField]) };

  _makeMatchResult(result, basic);
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$lt, function (index, value, basic, query) {
  _makeMatchResult({ include: index.getBetweenBounds(query) }, basic);
  delete query.$lt;
  delete query.$lte;
  delete query.$gt;
  delete query.$get;
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$lte, function () {
  QUERY_COMP_OPS_IMPL[_Document.QUERY_OPS.$lt].apply(QUERY_COMP_OPS_IMPL, arguments);
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$gt, function () {
  QUERY_COMP_OPS_IMPL[_Document.QUERY_OPS.$lt].apply(QUERY_COMP_OPS_IMPL, arguments);
}), _defineProperty(_QUERY_COMP_OPS_IMPL, _Document.QUERY_OPS.$gte, function () {
  QUERY_COMP_OPS_IMPL[_Document.QUERY_OPS.$lt].apply(QUERY_COMP_OPS_IMPL, arguments);
}), _QUERY_COMP_OPS_IMPL);

/**
 * Class for getting list of IDs by
 * given query object. For now it uses only
 * indexes for making requests and build indexes
 * on the fly. With this condition it have
 * some restrictions in supported operators
 * of MongoDB-like queries.
 */

var IndexMatcher = exports.IndexMatcher = (function () {
  function IndexMatcher(db, queryObj) {
    var sortObj = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, IndexMatcher);

    this.db = db;
    this.queryObj = queryObj;
    this.sortObj = sortObj;
    this._usedKeys = new Set();
  }

  /**
   * Matchs the query and resolve a list of Object IDs
   * @return {Promise}
   */

  _createClass(IndexMatcher, [{
    key: 'match',
    value: function match() {
      var _this = this;

      return this.execSortQuery().then(function (sortedIds) {
        sortedIds = (0, _isEmpty2.default)(sortedIds) ? _this.db.getIndexIds() : sortedIds;
        return _this.execQuery(_this.queryObj, sortedIds);
      }).then(function (queryRes) {
        return queryRes;
      });
    }

    /**
     * Try to get sorted ids by sort object.
     * If no sort object provided returns empty array.
     * if more then one sort key provided rises an exception.
     * First of all it try to execute a key-value query to
     * get result for sorting. If query not exists it gets
     * all objects in a collection.
     *
     * @return {Promise}
     */

  }, {
    key: 'execSortQuery',
    value: function execSortQuery() {
      var _this2 = this;

      var sortKeys = (0, _keys3.default)(this.sortObj);

      if (sortKeys.length > 1) {
        throw new Error('Multiple sort keys are not supported yet');
      } else if (sortKeys.length === 0) {
        return Promise.resolve();
      } else {
        var _ret = (function () {
          var sortKey = sortKeys[0];
          var keyQuery = _this2.queryObj[sortKey] || {};
          var sortDir = _this2.sortObj[sortKeys];
          var docIdsPromise = _this2.execLogicalQuery(sortKey, keyQuery);

          return {
            v: docIdsPromise.then(function (matchedRes) {
              var sortedRes = sortDir === -1 ? matchedRes.include.reverse() : matchedRes.include;

              _this2._usedKeys.add(sortKey);
              return sortedRes;
            })
          };
        })();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }
    }

    /**
     * Execute given query and return a list of
     * ids. If result superset provided then result
     * can't be larger then this superset.
     *
     * @param  {Object} query
     * @param  {Object} resultSuperset
     * @return {Promise}
     */

  }, {
    key: 'execQuery',
    value: function execQuery(query, resultSuperset) {
      var _this3 = this;

      query = _normilizeQuery(query);
      var queryKeys = (0, _keys3.default)(query);
      var unusedKeys = queryKeys.filter(function (x) {
        return !_this3._usedKeys.has(x);
      });
      var matchPromises = unusedKeys.map(function (k) {
        return _this3.execLogicalQuery(k, query[k]);
      });

      return Promise.all(matchPromises).then(function (matches) {
        // Get all included data
        var allIncludes = matches.filter(function (x) {
          return x.include;
        }).map(function (x) {
          return x.include;
        });
        if (Array.isArray(resultSuperset)) {
          allIncludes.unshift(resultSuperset);
        }
        var result = _getIncludeIntersection(allIncludes);

        // Exclude from result data
        var allExcludes = matches.filter(function (x) {
          return x.exclude;
        }).map(function (x) {
          return x.exclude;
        });
        allExcludes.unshift(result);
        return _getExcludeIntersection(allExcludes);
      });
    }

    /**
     * By given key execute a query. It process
     * special keys for logical operators ($and, $or, $not).
     * For executing regular key it uses indexes.
     * If index is not exists it invokes ensure
     * and then execute a query.
     *
     * @param  {String} key
     * @param  {Object} value
     * @return {Promise}
     */

  }, {
    key: 'execLogicalQuery',
    value: function execLogicalQuery(key, query) {
      var _this4 = this;

      if (key[0] === '$') {
        (0, _invariant2.default)(QUERY_LOGIC_OPS_IMPL[key], 'execLogicalQuery(...): logical operator %s is not supported', key);
        return QUERY_LOGIC_OPS_IMPL[key](this, key, query);
      }

      return this.db.ensureIndex({ fieldName: key }).then(function () {
        return _this4.execCompareQuery(_this4.db.indexes[key], query);
      });
    }

    /**
     * Retrives ids from given index by given query.
     * Supported operations are:
     *   $in, $lt, $lte, $gt, $gte,
     *   $exists, $regex
     * Returns a list of ids.
     *
     * @param  {Object} index
     * @param  {Object} query
     * @return {Array}
     */

  }, {
    key: 'execCompareQuery',
    value: function execCompareQuery(index, query) {
      // Uncombinable
      if (query && query.$exists !== undefined && index.fieldName === '_id') {
        if (query.$exists) {
          return _makeMatchResult({ include: index.getAll() });
        } else {
          return _makeMatchResult({ exclude: index.getAll() });
        }
      }
      if (_Utils2.default.isPrimitiveType(query)) {
        return _makeMatchResult({ include: index.getMatching(query) });
      }
      if (query instanceof RegExp) {
        query = { $regex: query };
      }

      // Clone for modify in processors
      query = _EJSON2.default.clone(query);

      // Combinable
      var basic = _makeMatchResult();
      var keys = (0, _keys3.default)(query);
      var dollarFirstKeys = keys.filter(function (k) {
        return k && k[0] === '$';
      });
      var pathKeys = keys.filter(function (k) {
        return k && k[0] !== '$';
      });
      var isOnlyDollar = !pathKeys.length && dollarFirstKeys.length;
      var isMixed = pathKeys.length && dollarFirstKeys.length;

      (0, _invariant2.default)(!isMixed, 'execCompareQuery(...): operators $... can\'t be mixed with normal fields');

      if (isOnlyDollar && dollarFirstKeys.length) {
        (0, _each3.default)(dollarFirstKeys, function (key) {
          (0, _invariant2.default)(QUERY_COMP_OPS_IMPL[key], 'execCompareQuery(...): operation %s not supported', key);
          if (query[key] !== undefined) {
            QUERY_COMP_OPS_IMPL[key](index, query[key], basic, query);
          }
        });
      } else {
        _makeMatchResult({ include: index.getMatching(query) }, basic);
      }

      return basic;
    }
  }]);

  return IndexMatcher;
})();

exports.default = IndexMatcher;