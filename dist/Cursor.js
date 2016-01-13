'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _PIPELINE_PROCESSORS;

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Cursor = exports.PIPELINE_PROCESSORS = exports.PIPELINE_TYPE = undefined;

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _keymirror = require('keymirror');

var _keymirror2 = _interopRequireDefault(_keymirror);

var _DocumentRetriver = require('./DocumentRetriver');

var _DocumentRetriver2 = _interopRequireDefault(_DocumentRetriver);

var _DocumentMatcher = require('./DocumentMatcher');

var _DocumentMatcher2 = _interopRequireDefault(_DocumentMatcher);

var _DocumentSorter = require('./DocumentSorter');

var _DocumentSorter2 = _interopRequireDefault(_DocumentSorter);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Maker used for stopping pipeline processing
var PIPLEINE_STOP_MARKER = {};

// Pipeline processors definition
var PIPELINE_TYPE = exports.PIPELINE_TYPE = (0, _keymirror2.default)({
  Filter: null,
  Sort: null,
  Map: null,
  Aggregate: null,
  Reduce: null,
  Join: null,
  JoinEach: null,
  JoinAll: null,
  IfNotEmpty: null
});

var PIPELINE_PROCESSORS = exports.PIPELINE_PROCESSORS = (_PIPELINE_PROCESSORS = {}, _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Filter, function (docs, pipeObj) {
  return docs.filter(pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Sort, function (docs, pipeObj) {
  return docs.sort(pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Map, function (docs, pipeObj) {
  return docs.map(pipeObj.value);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Aggregate, function (docs, pipeObj) {
  return pipeObj.value(docs);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Reduce, function (docs, pipeObj) {
  return docs.reduce(pipeObj.value, pipeObj.args[0]);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Join, function (docs, pipeObj, cursor) {
  if (_checkTypes2.default.array(docs)) {
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

  (0, _forEach2.default)(res, function (observeStopper) {
    if (_checkTypes2.default.object(observeStopper) && observeStopper.then) {
      if (observeStopper.parent) {
        observeStopper.parent(cursor);
        cursor.once('stopped', observeStopper.stop);
        cursor.once('cursorChanged', observeStopper.stop);
      }
    }
  });

  return Promise.all(res).then(function () {
    return docs;
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

var Cursor = (function (_EventEmitter) {
  _inherits(Cursor, _EventEmitter);

  function Cursor(db) {
    var query = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, Cursor);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Cursor).call(this));

    _this.db = db;
    _this.options = options;
    _this._query = query;
    _this._pipeline = [];
    _this._executing = null;
    _this._ensureMatcherSorter();
    return _this;
  }

  _createClass(Cursor, [{
    key: 'skip',
    value: function skip(_skip) {
      this._ensureNotExecuting();
      (0, _invariant2.default)(_skip >= 0 || typeof _skip === 'undefined', 'skip(...): skip must be a positive number');

      this._skip = _skip;
      return this;
    }
  }, {
    key: 'limit',
    value: function limit(_limit) {
      this._ensureNotExecuting();
      (0, _invariant2.default)(_limit >= 0 || typeof _limit === 'undefined', 'limit(...): limit must be a positive number');

      this._limit = _limit;
      return this;
    }
  }, {
    key: 'find',
    value: function find(query) {
      this._ensureNotExecuting();
      this._query = query || this._query;
      this._ensureMatcherSorter();
      return this;
    }
  }, {
    key: 'sort',
    value: function sort(sortObj) {
      this._ensureNotExecuting();
      (0, _invariant2.default)((typeof sortObj === 'undefined' ? 'undefined' : _typeof(sortObj)) === 'object' || typeof sortObj === 'undefined' || Array.isArray(sortObj), 'sort(...): argument must be an object');

      this._sort = sortObj;
      this._ensureMatcherSorter();
      return this;
    }
  }, {
    key: 'sortFunc',
    value: function sortFunc(sortFn) {
      (0, _invariant2.default)(typeof sortFn === 'function', 'sortFunc(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Sort, sortFn);
      return this;
    }
  }, {
    key: 'filter',
    value: function filter(filterFn) {
      (0, _invariant2.default)(typeof filterFn === 'function', 'filter(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Filter, filterFn);
      return this;
    }
  }, {
    key: 'map',
    value: function map(mapperFn) {
      (0, _invariant2.default)(typeof mapperFn === 'function', 'map(...): mapper must be a function');

      this.addPipeline(PIPELINE_TYPE.Map, mapperFn);
      return this;
    }
  }, {
    key: 'reduce',
    value: function reduce(reduceFn, initial) {
      (0, _invariant2.default)(typeof reduceFn === 'function', 'reduce(...): reducer argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Reduce, reduceFn, initial);
      return this;
    }
  }, {
    key: 'aggregate',
    value: function aggregate(aggrFn) {
      (0, _invariant2.default)(typeof aggrFn === 'function', 'aggregate(...): aggregator must be a function');

      this.addPipeline(PIPELINE_TYPE.Aggregate, aggrFn);
      return this;
    }
  }, {
    key: 'join',
    value: function join(joinFn) {
      (0, _invariant2.default)(typeof joinFn === 'function', 'join(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Join, joinFn);
      return this;
    }
  }, {
    key: 'joinEach',
    value: function joinEach(joinFn) {
      (0, _invariant2.default)(typeof joinFn === 'function', 'joinEach(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.JoinEach, joinFn);
      return this;
    }
  }, {
    key: 'joinAll',
    value: function joinAll(joinFn) {
      (0, _invariant2.default)(typeof joinFn === 'function', 'joinAll(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.JoinAll, joinFn);
      return this;
    }
  }, {
    key: 'ifNotEmpty',
    value: function ifNotEmpty() {
      this.addPipeline(PIPELINE_TYPE.IfNotEmpty);
      return this;
    }
  }, {
    key: 'addPipeline',
    value: function addPipeline(type, val) {
      this._ensureNotExecuting();
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
    key: 'processPipeline',
    value: function processPipeline(docs) {
      var _this2 = this;

      var i = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var pipeObj = this._pipeline[i];
      if (!pipeObj) {
        return Promise.resolve(docs);
      } else {
        return Promise.resolve(PIPELINE_PROCESSORS[pipeObj.type](docs, pipeObj, this)).then(function (result) {
          if (result === PIPLEINE_STOP_MARKER) {
            return result;
          } else {
            return _this2.processPipeline(result, i + 1);
          }
        });
      }
    }
  }, {
    key: 'processSkipLimits',
    value: function processSkipLimits(docs) {
      var skip = this._skip || 0;
      var limit = this._limit || docs.length;
      return docs.slice(skip, limit + skip);
    }
  }, {
    key: 'exec',
    value: function exec() {
      var _this3 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (!this._executing) {
        this._executing = this._prepareCursor(options).then(function () {
          return _this3._matchObjects();
        }).then(function (docs) {
          var clonned = undefined;
          if (_this3.options.noClone) {
            clonned = docs;
          } else {
            clonned = (0, _map3.default)(docs, function (doc) {
              return _EJSON2.default.clone(doc);
            });
          }

          return _this3.processPipeline(clonned);
        }).then(function (docs) {
          _this3._executing = null;
          return docs;
        });
      }

      return this._executing;
    }
  }, {
    key: 'then',
    value: function then(resolve, reject) {
      return this.exec().then(resolve, reject);
    }
  }, {
    key: 'whenNotExecuting',
    value: function whenNotExecuting() {
      return Promise.resolve(this._executing);
    }
  }, {
    key: '_prepareCursor',
    value: function _prepareCursor() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return Promise.resolve();
    }
  }, {
    key: '_matchObjects',
    value: function _matchObjects() {
      var _this4 = this;

      return new _DocumentRetriver2.default(this.db).retriveForQeury(this._query).then(function (docs) {
        var results = [];
        var withFastLimit = _this4._limit && !_this4._skip && !_this4._sorter;

        (0, _forEach2.default)(docs, function (d) {
          var match = _this4._matcher.documentMatches(d);
          if (match.result) {
            results.push(d);
          }
          if (withFastLimit && results.length === _this4._limit) {
            return false;
          }
        });

        if (withFastLimit) {
          return results;
        }

        if (_this4._sorter) {
          var comparator = _this4._sorter.getComparator();
          results.sort(comparator);
        }

        return _this4.processSkipLimits(results);
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
    key: '_ensureNotExecuting',
    value: function _ensureNotExecuting() {
      (0, _invariant2.default)(!this.isExecuting, '_ensureNotExecuting(...): cursor is executing, cursor is immutable!');
    }
  }, {
    key: 'isExecuting',
    get: function get() {
      return !!this._executing;
    }
  }]);

  return Cursor;
})(_eventemitter2.default);

exports.Cursor = Cursor;
exports.default = Cursor;