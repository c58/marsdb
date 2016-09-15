'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IndexManager = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _values2 = require('fast.js/object/values');

var _values3 = _interopRequireDefault(_values2);

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _PromiseQueue = require('./PromiseQueue');

var _PromiseQueue2 = _interopRequireDefault(_PromiseQueue);

var _MapIndex = require('./MapIndex');

var _MapIndex2 = _interopRequireDefault(_MapIndex);

var _DocumentRetriver = require('./DocumentRetriver');

var _DocumentRetriver2 = _interopRequireDefault(_DocumentRetriver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Manager for controlling a list of indexes
 * for some model. Building indexes is promise
 * based.
 * By default it creates an index for `_id` field.
 */
/* istanbul ignore next */

var IndexManager = exports.IndexManager = function () {
  function IndexManager(db) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, IndexManager);

    this.db = db;
    this.indexes = {};
    this._queue = new _PromiseQueue2.default(options.concurrency || 2);

    // By default create index by _id field
    this.createIndex('_id', { unique: true });
  }

  /**
   * Check index existance for given `options.fieldName` and
   * if index not exists it creates new one.
   * Always return a promise that resolved only when
   * index succesfully created, built and ready for working with.
   * If `options.forceRebuild` provided and equals to true then
   * existing index will be rebuilt, otherwise existing index
   * don't touched.
   *
   * @param  {Object} key  name of the field for indexing
   * @param  {Object} options.forceRebuild  rebuild index if it exists
   * @return {Promise}
   */


  _createClass(IndexManager, [{
    key: 'createIndex',
    value: function createIndex(key, options) {
      (0, _invariant2.default)(key && (!options || options && !options.key), 'You must specify a key out of options object, as a first argument');

      if (!this.indexes[key]) {
        this.indexes[key] = new _MapIndex2.default(key, options);
        return this.buildIndex(key);
      } else if (this.indexes[key].buildPromise) {
        return this.indexes[key].buildPromise;
      } else if (options && options.forceRebuild) {
        return this.buildIndex(key);
      } else {
        return Promise.resolve();
      }
    }

    /**
     * Buld an existing index (created) and return a
     * promise that will be resolved only when index successfully
     * built for all documents in the storage.
     * @param  {String} key
     * @return {Promise}
     */

  }, {
    key: 'buildIndex',
    value: function buildIndex(key) {
      var _this = this;

      (0, _invariant2.default)(this.indexes[key], 'Index with key `%s` does not created yet', key);

      var cleanup = function cleanup() {
        return _this.indexes[key].buildPromise = null;
      };
      var buildPromise = this._queue.add((0, _bind3.default)(this._doBuildIndex, this, key)).then(cleanup, cleanup);

      this.indexes[key].buildPromise = buildPromise;
      return buildPromise;
    }

    /**
     * Schedule a task for each index in the
     * manager. Return promise that will be resolved
     * when all indexes is successfully built.
     * @return {Promise}
     */

  }, {
    key: 'buildAllIndexes',
    value: function buildAllIndexes() {
      var _this2 = this;

      return Promise.all((0, _values3.default)((0, _map3.default)(this.indexes, function (v, k) {
        return _this2.createIndex(k, { forceRebuild: true });
      })));
    }

    /**
     * Remove an index
     * @param  {String} key
     * @return {Promise}
     */

  }, {
    key: 'removeIndex',
    value: function removeIndex(key) {
      var _this3 = this;

      return this._queue.add(function () {
        delete _this3.indexes[key];
      });
    }

    /**
     * Add a document to all indexes
     * @param  {Object} doc
     * @return {Promise}
     */

  }, {
    key: 'indexDocument',
    value: function indexDocument(doc) {
      var _this4 = this;

      return this._queue.add(function () {
        var keys = (0, _keys3.default)(_this4.indexes);
        var failingIndex = null;
        var res = (0, _try3.default)(function () {
          (0, _forEach2.default)(keys, function (k, i) {
            failingIndex = i;
            _this4.indexes[k].insert(doc);
          });
        });
        if (res instanceof Error) {
          (0, _forEach2.default)(keys.slice(0, failingIndex), function (k) {
            _this4.indexes[k].remove(doc);
          });
          throw res;
        }
      });
    }

    /**
     * Update all indexes with new version of
     * the document
     * @param  {Object} oldDoc
     * @param  {Object} newDoc
     * @return {Promise}
     */

  }, {
    key: 'reindexDocument',
    value: function reindexDocument(oldDoc, newDoc) {
      var _this5 = this;

      return this._queue.add(function () {
        var keys = (0, _keys3.default)(_this5.indexes);
        var failingIndex = null;
        var res = (0, _try3.default)(function () {
          (0, _forEach2.default)(keys, function (k, i) {
            failingIndex = i;
            _this5.indexes[k].update(oldDoc, newDoc);
          });
        });
        if (res instanceof Error) {
          (0, _forEach2.default)(keys.slice(0, failingIndex + 1), function (k) {
            _this5.indexes[k].revertUpdate(oldDoc, newDoc);
          });
          throw e;
        }
      });
    }

    /**
     * Remove document from all indexes
     * @param  {Object} doc
     * @return {Promise}
     */

  }, {
    key: 'deindexDocument',
    value: function deindexDocument(doc) {
      var _this6 = this;

      return this._queue.add(function () {
        var keys = (0, _keys3.default)(_this6.indexes);
        (0, _forEach2.default)(keys, function (k) {
          _this6.indexes[k].remove(doc);
        });
      });
    }

    /**
     * Build an existing index with reseting first
     * @param  {String} key
     * @return {Promise}
     */

  }, {
    key: '_doBuildIndex',
    value: function _doBuildIndex(key) {
      // Get and reset index
      var index = this.indexes[key];
      index.reset();

      // Loop through all doucments in the storage
      var errors = [];
      return new _DocumentRetriver2.default(this.db).retriveAll().then(function (docs) {
        (0, _forEach2.default)(docs, function (doc) {
          var res = (0, _try3.default)(function () {
            index.insert(doc);
          });
          if (res instanceof Error) {
            errors.push([res, doc]);
          }
        });

        if (errors.length > 0) {
          throw new Error('Index build failed with errors: ', errors);
        }
      });
    }
  }]);

  return IndexManager;
}();

exports.default = IndexManager;