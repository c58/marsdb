'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _PIPELINE_PROCESSORS;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Cursor = exports.PIPELINE_PROCESSORS = exports.PIPELINE_TYPE = undefined;

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

var _reduce2 = require('fast.js/array/reduce');

var _reduce3 = _interopRequireDefault(_reduce2);

var _assign2 = require('fast.js/object/assign');

var _assign3 = _interopRequireDefault(_assign2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _AsyncEventEmitter2 = require('./AsyncEventEmitter');

var _AsyncEventEmitter3 = _interopRequireDefault(_AsyncEventEmitter2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _Document = require('./Document');

var _DocumentRetriver = require('./DocumentRetriver');

var _DocumentRetriver2 = _interopRequireDefault(_DocumentRetriver);

var _DocumentMatcher = require('./DocumentMatcher');

var _DocumentMatcher2 = _interopRequireDefault(_DocumentMatcher);

var _DocumentSorter = require('./DocumentSorter');

var _DocumentSorter2 = _interopRequireDefault(_DocumentSorter);

var _DocumentProjector = require('./DocumentProjector');

var _DocumentProjector2 = _interopRequireDefault(_DocumentProjector);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// UUID counter for all cursors
var _currentCursorId = 0;

// Maker used for stopping pipeline processing
var PIPLEINE_STOP_MARKER = {};

// Pipeline processors definition
var PIPELINE_TYPE = exports.PIPELINE_TYPE = {
  Filter: 'Filter',
  Sort: 'Sort',
  Map: 'Map',
  Aggregate: 'Aggregate',
  Reduce: 'Reduce',
  Join: 'Join',
  JoinEach: 'JoinEach',
  JoinAll: 'JoinAll',
  JoinObj: 'JoinObj',
  IfNotEmpty: 'IfNotEmpty'
};

var PIPELINE_PROCESSORS = exports.PIPELINE_PROCESSORS = (_PIPELINE_PROCESSORS = {}, _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Filter, function (docs, pipeObj) {
  return (0, _filter3.default)(docs, pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Sort, function (docs, pipeObj) {
  return docs.sort(pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Map, function (docs, pipeObj) {
  return (0, _map3.default)(docs, pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Aggregate, function (docs, pipeObj) {
  return pipeObj.value(docs);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Reduce, function (docs, pipeObj) {
  return (0, _reduce3.default)(docs, pipeObj.value, pipeObj.args[0]);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Join, function (docs, pipeObj, cursor) {
  if (_checkTypes2.default.object(pipeObj.value)) {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinObj](docs, pipeObj, cursor);
  } else if (_checkTypes2.default.array(docs)) {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinEach](docs, pipeObj, cursor);
  } else {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](docs, pipeObj, cursor);
  }
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.JoinEach, function (docs, pipeObj, cursor) {
  docs = _checkTypes2.default.array(docs) ? docs : [docs];
  var docsLength = docs.length;
  return Promise.all((0, _map3.default)(docs, function (x, i) {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](x, pipeObj, cursor, i, docsLength);
  }));
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.JoinAll, function (docs, pipeObj, cursor) {
  var i = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];
  var len = arguments.length <= 4 || arguments[4] === undefined ? 1 : arguments[4];

  var updatedFn = cursor._propagateUpdate ? (0, _bind3.default)(cursor._propagateUpdate, cursor) : function () {};

  var res = pipeObj.value(docs, updatedFn, i, len);
  res = _checkTypes2.default.array(res) ? res : [res];
  res = (0, _map3.default)(res, function (val) {
    var cursorPromise = undefined;
    if (val instanceof Cursor) {
      cursorPromise = val.exec();
    } else if (_checkTypes2.default.object(val) && val.cursor && val.then) {
      cursorPromise = val;
    }
    if (cursorPromise) {
      cursor._trackChildCursorPromise(cursorPromise);
    }
    return cursorPromise || val;
  });

  return Promise.all(res).then(function () {
    return docs;
  });
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.JoinObj, function (docs, pipeObj, cursor) {
  var joinObj = pipeObj.value;
  var options = pipeObj.args[0] || {};
  var isObj = !_checkTypes2.default.array(docs);
  docs = !isObj ? docs : [docs];

  var joinerFn = function joinerFn(dcs) {
    return (0, _map3.default)((0, _keys3.default)(joinObj), function (k) {
      var joinKey = k.split('.')[0];
      var model = joinObj[k];
      var lookupFn = (0, _DocumentMatcher.makeLookupFunction)(k);
      var childToRootMap = {};
      var docsById = {};
      var allIds = [];

      (0, _forEach2.default)(dcs, function (d) {
        docsById[d._id] = { d: d, isArray: false };

        var val = lookupFn(d);
        var singleJoin = !val[0] || !val[0].arrayIndices;
        var joinIds = (0, _filter3.default)((0, _reduce3.default)((0, _map3.default)(val, function (x) {
          return x.value;
        }), function (a, b) {
          if (_checkTypes2.default.array(b)) {
            singleJoin = false;
            return [].concat(_toConsumableArray(a), _toConsumableArray(b));
          } else {
            return [].concat(_toConsumableArray(a), [b]);
          }
        }, []), function (x) {
          return (0, _Document.selectorIsId)(x);
        });

        allIds = allIds.concat(joinIds);
        docsById[d._id].isArray = !singleJoin;
        d[joinKey] = singleJoin ? null : [];

        (0, _forEach2.default)(joinIds, function (joinId) {
          var localIdsMap = childToRootMap[joinId] || [];
          localIdsMap.push(d._id);
          childToRootMap[joinId] = localIdsMap;
        });
      });

      var execFnName = options.observe ? 'observe' : 'then';
      return model.find({ _id: { $in: allIds } })[execFnName](function (res) {
        (0, _forEach2.default)(res, function (objToJoin) {
          var docIdsForJoin = childToRootMap[objToJoin._id];
          (0, _forEach2.default)(docIdsForJoin, function (docId) {
            var doc = docsById[docId];
            if (doc) {
              if (doc.isArray) {
                doc.d[joinKey].push(objToJoin);
              } else {
                doc.d[joinKey] = objToJoin;
              }
            }
          });
        });
      });
    });
  };

  var newPipeObj = _extends({}, pipeObj, { value: joinerFn });
  return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](docs, newPipeObj, cursor).then(function (res) {
    return isObj ? res[0] : res;
  });
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.IfNotEmpty, function (docs) {
  var isEmptyRes = !_checkTypes2.default.assigned(docs) || _checkTypes2.default.array(docs) && _checkTypes2.default.emptyArray(docs) || _checkTypes2.default.object(docs) && _checkTypes2.default.emptyObject(docs);
  return isEmptyRes ? PIPLEINE_STOP_MARKER : docs;
}), _PIPELINE_PROCESSORS);

/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */

var Cursor = function (_AsyncEventEmitter) {
  _inherits(Cursor, _AsyncEventEmitter);

  function Cursor(db) {
    var query = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, Cursor);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Cursor).call(this));

    _this.db = db;
    _this.options = options;
    _this._id = _currentCursorId++;
    _this._query = query;
    _this._pipeline = [];
    _this._latestResult = null;
    _this._childrenCursors = {};
    _this._parentCursors = {};
    _this._ensureMatcherSorter();
    return _this;
  }

  _createClass(Cursor, [{
    key: 'skip',
    value: function skip(_skip) {
      (0, _invariant2.default)(_skip >= 0 || typeof _skip === 'undefined', 'skip(...): skip must be a positive number');

      this._skip = _skip;
      return this;
    }
  }, {
    key: 'limit',
    value: function limit(_limit) {
      (0, _invariant2.default)(_limit >= 0 || typeof _limit === 'undefined', 'limit(...): limit must be a positive number');

      this._limit = _limit;
      return this;
    }
  }, {
    key: 'find',
    value: function find(query) {
      this._query = query;
      this._ensureMatcherSorter();
      return this;
    }
  }, {
    key: 'project',
    value: function project(projection) {
      if (projection) {
        this._projector = new _DocumentProjector2.default(projection);
      } else {
        this._projector = null;
      }
      return this;
    }
  }, {
    key: 'sort',
    value: function sort(sortObj) {
      (0, _invariant2.default)((typeof sortObj === 'undefined' ? 'undefined' : _typeof(sortObj)) === 'object' || typeof sortObj === 'undefined' || Array.isArray(sortObj), 'sort(...): argument must be an object');

      this._sort = sortObj;
      this._ensureMatcherSorter();
      return this;
    }
  }, {
    key: 'sortFunc',
    value: function sortFunc(sortFn) {
      (0, _invariant2.default)(typeof sortFn === 'function', 'sortFunc(...): argument must be a function');

      this._addPipeline(PIPELINE_TYPE.Sort, sortFn);
      return this;
    }
  }, {
    key: 'filter',
    value: function filter(filterFn) {
      (0, _invariant2.default)(typeof filterFn === 'function', 'filter(...): argument must be a function');

      this._addPipeline(PIPELINE_TYPE.Filter, filterFn);
      return this;
    }
  }, {
    key: 'map',
    value: function map(mapperFn) {
      (0, _invariant2.default)(typeof mapperFn === 'function', 'map(...): mapper must be a function');

      this._addPipeline(PIPELINE_TYPE.Map, mapperFn);
      return this;
    }
  }, {
    key: 'reduce',
    value: function reduce(reduceFn, initial) {
      (0, _invariant2.default)(typeof reduceFn === 'function', 'reduce(...): reducer argument must be a function');

      this._addPipeline(PIPELINE_TYPE.Reduce, reduceFn, initial);
      return this;
    }
  }, {
    key: 'aggregate',
    value: function aggregate(aggrFn) {
      (0, _invariant2.default)(typeof aggrFn === 'function', 'aggregate(...): aggregator must be a function');

      this._addPipeline(PIPELINE_TYPE.Aggregate, aggrFn);
      return this;
    }
  }, {
    key: 'join',
    value: function join(joinFn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      (0, _invariant2.default)(typeof joinFn === 'function' || _checkTypes2.default.object(joinFn), 'join(...): argument must be a function');

      this._addPipeline(PIPELINE_TYPE.Join, joinFn, options);
      return this;
    }
  }, {
    key: 'joinEach',
    value: function joinEach(joinFn) {
      (0, _invariant2.default)(typeof joinFn === 'function', 'joinEach(...): argument must be a function');

      this._addPipeline(PIPELINE_TYPE.JoinEach, joinFn);
      return this;
    }
  }, {
    key: 'joinAll',
    value: function joinAll(joinFn) {
      (0, _invariant2.default)(typeof joinFn === 'function', 'joinAll(...): argument must be a function');

      this._addPipeline(PIPELINE_TYPE.JoinAll, joinFn);
      return this;
    }
  }, {
    key: 'joinObj',
    value: function joinObj(obj) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      (0, _invariant2.default)(_checkTypes2.default.object(obj), 'joinObj(...): argument must be an object');

      this._addPipeline(PIPELINE_TYPE.JoinObj, obj, options);
      return this;
    }
  }, {
    key: 'ifNotEmpty',
    value: function ifNotEmpty() {
      this._addPipeline(PIPELINE_TYPE.IfNotEmpty);
      return this;
    }
  }, {
    key: 'exec',
    value: function exec() {
      var _this2 = this;

      this.emit('beforeExecute');
      return this._createCursorPromise(this._doExecute().then(function (result) {
        _this2._latestResult = result;
        return result;
      }));
    }
  }, {
    key: 'then',
    value: function then(resolve, reject) {
      return this.exec().then(resolve, reject);
    }
  }, {
    key: '_addPipeline',
    value: function _addPipeline(type, val) {
      (0, _invariant2.default)(type && PIPELINE_TYPE[type], 'Unknown pipeline processor type %s', type);

      for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }

      this._pipeline.push({
        type: type,
        value: val,
        args: args || []
      });
      return this;
    }
  }, {
    key: '_processPipeline',
    value: function _processPipeline(docs) {
      var _this3 = this;

      var i = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var pipeObj = this._pipeline[i];
      if (!pipeObj) {
        return Promise.resolve(docs);
      } else {
        return Promise.resolve(PIPELINE_PROCESSORS[pipeObj.type](docs, pipeObj, this)).then(function (result) {
          if (result === PIPLEINE_STOP_MARKER) {
            return result;
          } else {
            return _this3._processPipeline(result, i + 1);
          }
        });
      }
    }
  }, {
    key: '_doExecute',
    value: function _doExecute() {
      var _this4 = this;

      return this._matchObjects().then(function (docs) {
        var clonned = undefined;
        if (_this4.options.noClone) {
          clonned = docs;
        } else {
          if (!_this4._projector) {
            clonned = (0, _map3.default)(docs, function (doc) {
              return _EJSON2.default.clone(doc);
            });
          } else {
            clonned = _this4._projector.project(docs);
          }
        }
        return _this4._processPipeline(clonned);
      });
    }
  }, {
    key: '_matchObjects',
    value: function _matchObjects() {
      var _this5 = this;

      return new _DocumentRetriver2.default(this.db).retriveForQeury(this._query).then(function (docs) {
        var results = [];
        var withFastLimit = _this5._limit && !_this5._skip && !_this5._sorter;

        (0, _forEach2.default)(docs, function (d) {
          var match = _this5._matcher.documentMatches(d);
          if (match.result) {
            results.push(d);
          }
          if (withFastLimit && results.length === _this5._limit) {
            return false;
          }
        });

        if (withFastLimit) {
          return results;
        }

        if (_this5._sorter) {
          var comparator = _this5._sorter.getComparator();
          results.sort(comparator);
        }

        var skip = _this5._skip || 0;
        var limit = _this5._limit || results.length;
        return results.slice(skip, limit + skip);
      });
    }
  }, {
    key: '_ensureMatcherSorter',
    value: function _ensureMatcherSorter() {
      this._sorter = undefined;
      this._matcher = new _DocumentMatcher2.default(this._query || {});

      if (this._matcher.hasGeoQuery || this._sort) {
        this._sorter = new _DocumentSorter2.default(this._sort || [], { matcher: this._matcher });
      }
    }
  }, {
    key: '_trackChildCursorPromise',
    value: function _trackChildCursorPromise(childCursorPromise) {
      var _this6 = this;

      var childCursor = childCursorPromise.cursor;
      this._childrenCursors[childCursor._id] = childCursor;
      childCursor._parentCursors[this._id] = this;

      this.once('beforeExecute', function () {
        delete _this6._childrenCursors[childCursor._id];
        delete childCursor._parentCursors[_this6._id];
        if ((0, _keys3.default)(childCursor._parentCursors).length === 0) {
          childCursor.emit('beforeExecute');
        }
      });
    }
  }, {
    key: '_createCursorPromise',
    value: function _createCursorPromise(promise) {
      var _this7 = this;

      var mixin = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return (0, _assign3.default)({
        cursor: this,
        then: function then(successFn, failFn) {
          return _this7._createCursorPromise(promise.then(successFn, failFn), mixin);
        }
      }, mixin);
    }
  }]);

  return Cursor;
}(_AsyncEventEmitter3.default);

exports.Cursor = Cursor;
exports.default = Cursor;