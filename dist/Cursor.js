'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Cursor = exports.PIPELINE_PROCESSORS = undefined;

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _assign2 = require('fast.js/object/assign');

var _assign3 = _interopRequireDefault(_assign2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _AsyncEventEmitter2 = require('./AsyncEventEmitter');

var _AsyncEventEmitter3 = _interopRequireDefault(_AsyncEventEmitter2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

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

// UUID counter for all cursors
var _currentCursorId = 0;

// Pipeline processors map
var PIPELINE_PROCESSORS = exports.PIPELINE_PROCESSORS = _extends({}, require('./cursor-processors/filter'), require('./cursor-processors/sortFunc'), require('./cursor-processors/map'), require('./cursor-processors/aggregate'), require('./cursor-processors/reduce'), require('./cursor-processors/join'), require('./cursor-processors/joinEach'), require('./cursor-processors/joinAll'), require('./cursor-processors/joinObj'), require('./cursor-processors/ifNotEmpty'));

// Create basic cursor with pipeline methods

var BasicCursor = function (_AsyncEventEmitter) {
  _inherits(BasicCursor, _AsyncEventEmitter);

  function BasicCursor() {
    _classCallCheck(this, BasicCursor);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BasicCursor).apply(this, arguments));
  }

  return BasicCursor;
}(_AsyncEventEmitter3.default);

(0, _forEach2.default)(PIPELINE_PROCESSORS, function (v, procName) {
  BasicCursor.prototype[procName] = v.method;
});

/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */

var Cursor = function (_BasicCursor) {
  _inherits(Cursor, _BasicCursor);

  function Cursor(db) {
    var query = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, Cursor);

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(Cursor).call(this));

    _this2.db = db;
    _this2.options = options;
    _this2._id = _currentCursorId++;
    _this2._query = query;
    _this2._pipeline = [];
    _this2._latestResult = null;
    _this2._childrenCursors = {};
    _this2._parentCursors = {};
    _this2._ensureMatcherSorter();
    return _this2;
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
    key: 'exec',
    value: function exec() {
      var _this3 = this;

      this.emit('beforeExecute');
      return this._createCursorPromise(this._doExecute().then(function (result) {
        _this3._latestResult = result;
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
      (0, _invariant2.default)(type && PIPELINE_PROCESSORS[type], 'Unknown pipeline processor type %s', type);

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
      var _this4 = this;

      var i = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var pipeObj = this._pipeline[i];
      if (!pipeObj) {
        return Promise.resolve(docs);
      } else {
        return Promise.resolve(PIPELINE_PROCESSORS[pipeObj.type].process(docs, pipeObj, this)).then(function (result) {
          if (result === '___[STOP]___') {
            return result;
          } else {
            return _this4._processPipeline(result, i + 1);
          }
        });
      }
    }
  }, {
    key: '_doExecute',
    value: function _doExecute() {
      var _this5 = this;

      return this._matchObjects().then(function (docs) {
        var clonned = undefined;
        if (_this5.options.noClone) {
          clonned = docs;
        } else {
          if (!_this5._projector) {
            clonned = (0, _map3.default)(docs, function (doc) {
              return _EJSON2.default.clone(doc);
            });
          } else {
            clonned = _this5._projector.project(docs);
          }
        }
        return _this5._processPipeline(clonned);
      });
    }
  }, {
    key: '_matchObjects',
    value: function _matchObjects() {
      var _this6 = this;

      var withFastLimit = this._limit && !this._skip && !this._sorter;
      var retrOpts = withFastLimit ? { limit: this._limit } : {};
      var queryFilter = function queryFilter(doc) {
        return doc && _this6._matcher.documentMatches(doc).result;
      };

      return new _DocumentRetriver2.default(this.db).retriveForQeury(this._query, queryFilter, retrOpts).then(function (results) {
        if (withFastLimit) {
          return results;
        }

        if (_this6._sorter) {
          var comparator = _this6._sorter.getComparator();
          results.sort(comparator);
        }

        var skip = _this6._skip || 0;
        var limit = _this6._limit || results.length;
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
      var _this7 = this;

      var childCursor = childCursorPromise.cursor;
      this._childrenCursors[childCursor._id] = childCursor;
      childCursor._parentCursors[this._id] = this;

      this.once('beforeExecute', function () {
        delete _this7._childrenCursors[childCursor._id];
        delete childCursor._parentCursors[_this7._id];
        if ((0, _keys3.default)(childCursor._parentCursors).length === 0) {
          childCursor.emit('beforeExecute');
        }
      });
    }
  }, {
    key: '_createCursorPromise',
    value: function _createCursorPromise(promise) {
      var _this8 = this;

      var mixin = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return (0, _assign3.default)({
        cursor: this,
        then: function then(successFn, failFn) {
          return _this8._createCursorPromise(promise.then(successFn, failFn), mixin);
        }
      }, mixin);
    }
  }]);

  return Cursor;
}(BasicCursor);

exports.Cursor = Cursor;
exports.default = Cursor;