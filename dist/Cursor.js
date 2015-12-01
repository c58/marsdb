'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { var object = _x2, property = _x3, receiver = _x4; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _PIPELINE_PROCESSORS;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _lodashCollectionEach = require('lodash/collection/each');

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _lodashLangIsObject = require('lodash/lang/isObject');

var _lodashLangIsObject2 = _interopRequireDefault(_lodashLangIsObject);

var _lodashLangToArray = require('lodash/lang/toArray');

var _lodashLangToArray2 = _interopRequireDefault(_lodashLangToArray);

var _lodashLangIsEmpty = require('lodash/lang/isEmpty');

var _lodashLangIsEmpty2 = _interopRequireDefault(_lodashLangIsEmpty);

var _eventemitter3 = require('eventemitter3');

var _eventemitter32 = _interopRequireDefault(_eventemitter3);

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

// Maker used for stopping pipeline processing
var PIPLEINE_STOP_MARKER = {};

// Pipeline processors definition
var PIPELINE_TYPE = (0, _keymirror2['default'])({
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

exports.PIPELINE_TYPE = PIPELINE_TYPE;
var PIPELINE_PROCESSORS = (_PIPELINE_PROCESSORS = {}, _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.Filter, function (docs, pipeObj) {
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
  return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinEach](docs, pipeObj, cursor);
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.JoinEach, function (docs, pipeObj, cursor) {
  return Promise.all((0, _lodashLangToArray2['default'])(docs).map(function (x) {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](x, pipeObj, cursor);
  }));
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.JoinAll, function (docs, pipeObj, cursor) {
  var res = pipeObj.value(docs);
  if ((0, _lodashLangIsObject2['default'])(res) && res.then) {
    if (res.parent) {
      res.parent(cursor);
      cursor.once('stopped', res.stop);
    }
    return res.then(function () {
      return docs;
    });
  } else {
    return docs;
  }
}), _defineProperty(_PIPELINE_PROCESSORS, PIPELINE_TYPE.IfNotEmpty, function (docs) {
  return (0, _lodashLangIsEmpty2['default'])(docs) ? PIPLEINE_STOP_MARKER : docs;
}), _PIPELINE_PROCESSORS);

exports.PIPELINE_PROCESSORS = PIPELINE_PROCESSORS;
/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */

var Cursor = (function (_EventEmitter) {
  _inherits(Cursor, _EventEmitter);

  function Cursor(db, query) {
    _classCallCheck(this, Cursor);

    _get(Object.getPrototypeOf(Cursor.prototype), 'constructor', this).call(this);
    this.db = db;
    this._query = query;
    this._pipeline = [];
    this._ensureMatcherSorter();
  }

  _createClass(Cursor, [{
    key: 'skip',
    value: function skip(_skip) {
      this._ensureNotExecuting();
      (0, _invariant2['default'])(_skip >= 0 || typeof _skip === 'undefined', 'skip(...): skip must be a positive number');

      this._skip = _skip;
      return this;
    }
  }, {
    key: 'limit',
    value: function limit(_limit) {
      this._ensureNotExecuting();
      (0, _invariant2['default'])(_limit >= 0 || typeof _limit === 'undefined', 'limit(...): limit must be a positive number');

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
      (0, _invariant2['default'])(typeof sortObj === 'object' || typeof sortObj === 'undefined' || Array.isArray(sortObj), 'sort(...): argument must be an object');

      this._sort = sortObj;
      this._ensureMatcherSorter();
      return this;
    }
  }, {
    key: 'sortFunc',
    value: function sortFunc(sortFn) {
      (0, _invariant2['default'])(typeof sortFn === 'function', 'sortFunc(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Sort, sortFn);
      return this;
    }
  }, {
    key: 'filter',
    value: function filter(filterFn) {
      (0, _invariant2['default'])(typeof filterFn === 'function', 'filter(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Filter, filterFn);
      return this;
    }
  }, {
    key: 'map',
    value: function map(mapperFn) {
      (0, _invariant2['default'])(typeof mapperFn === 'function', 'map(...): mapper must be a function');

      this.addPipeline(PIPELINE_TYPE.Map, mapperFn);
      return this;
    }
  }, {
    key: 'reduce',
    value: function reduce(reduceFn, initial) {
      (0, _invariant2['default'])(typeof reduceFn === 'function', 'reduce(...): reducer argument must be a function');

      this.addPipeline(PIPELINE_TYPE.Reduce, reduceFn, initial);
      return this;
    }
  }, {
    key: 'aggregate',
    value: function aggregate(aggrFn) {
      (0, _invariant2['default'])(typeof aggrFn === 'function', 'aggregate(...): aggregator must be a function');

      this.addPipeline(PIPELINE_TYPE.Aggregate, aggrFn);
      return this;
    }
  }, {
    key: 'join',
    value: function join(joinFn) {
      return this.joinEach(joinFn);
    }
  }, {
    key: 'joinEach',
    value: function joinEach(joinFn) {
      (0, _invariant2['default'])(typeof joinFn === 'function', 'joinEach(...): argument must be a function');

      this.addPipeline(PIPELINE_TYPE.JoinEach, joinFn);
      return this;
    }
  }, {
    key: 'joinAll',
    value: function joinAll(joinFn) {
      (0, _invariant2['default'])(typeof joinFn === 'function', 'joinAll(...): argument must be a function');

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
      (0, _invariant2['default'])(type && PIPELINE_TYPE[type], 'Unknown pipeline processor type %s', type);

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
      var _this = this;

      var i = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var pipeObj = this._pipeline[i];
      if (!pipeObj) {
        return Promise.resolve(docs);
      } else {
        return Promise.resolve(PIPELINE_PROCESSORS[pipeObj.type](docs, pipeObj, this)).then(function (result) {
          if (result === PIPLEINE_STOP_MARKER) {
            return result;
          } else {
            return _this.processPipeline(result, i + 1);
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
      var _this2 = this;

      this._executing = true;
      return this._matchObjects().then(function (docs) {
        return _this2.processPipeline(docs);
      }).then(function (docs) {
        _this2._executing = false;
        return docs;
      });
    }
  }, {
    key: 'ids',
    value: function ids() {
      var _this3 = this;

      this._executing = true;
      return this._matchObjects().then(function (docs) {
        return docs.map(function (x) {
          return x._id;
        });
      }).then(function (ids) {
        _this3._executing = false;
        return ids;
      });
    }
  }, {
    key: 'then',
    value: function then(resolve, reject) {
      return this.exec().then(resolve, reject);
    }
  }, {
    key: '_matchObjects',
    value: function _matchObjects() {
      var _this4 = this;

      return new _DocumentRetriver2['default'](this.db).retriveForQeury(this._query).then(function (docs) {
        var results = [];
        var withFastLimit = _this4._limit && !_this4._skip && !_this4._sorter;

        (0, _lodashCollectionEach2['default'])(docs, function (d) {
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
      this._matcher = new _DocumentMatcher2['default'](this._query || {});

      if (this._matcher.hasGeoQuery || this._sort) {
        this._sorter = new _DocumentSorter2['default'](this._sort || [], { matcher: this._matcher });
      }
    }
  }, {
    key: '_ensureNotExecuting',
    value: function _ensureNotExecuting() {
      (0, _invariant2['default'])(!this.isExecuting, '_ensureNotExecuting(...): cursor is executing, cursor is immutable!');
    }
  }, {
    key: 'isExecuting',
    get: function () {
      return !!this._executing;
    }
  }]);

  return Cursor;
})(_eventemitter32['default']);

exports.Cursor = Cursor;
exports['default'] = Cursor;