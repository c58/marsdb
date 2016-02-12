'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Collection = undefined;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _AsyncEventEmitter = require('./AsyncEventEmitter');

var _AsyncEventEmitter2 = _interopRequireDefault(_AsyncEventEmitter);

var _IndexManager = require('./IndexManager');

var _IndexManager2 = _interopRequireDefault(_IndexManager);

var _PromiseQueue = require('./PromiseQueue');

var _PromiseQueue2 = _interopRequireDefault(_PromiseQueue);

var _StorageManager = require('./StorageManager');

var _StorageManager2 = _interopRequireDefault(_StorageManager);

var _CollectionDelegate = require('./CollectionDelegate');

var _CollectionDelegate2 = _interopRequireDefault(_CollectionDelegate);

var _CursorObservable = require('./CursorObservable');

var _CursorObservable2 = _interopRequireDefault(_CursorObservable);

var _ShortIdGenerator = require('./ShortIdGenerator');

var _ShortIdGenerator2 = _interopRequireDefault(_ShortIdGenerator);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Defaults
var _defaultCursor = _CursorObservable2.default;
var _defaultDelegate = _CollectionDelegate2.default;
var _defaultStorageManager = _StorageManager2.default;
var _defaultIndexManager = _IndexManager2.default;
var _defaultIdGenerator = _ShortIdGenerator2.default;

/**
 * Core class of the database.
 * It delegates almost all it's methods to managers
 * and emits events for live queries and other cuctomisation.
 */

var Collection = exports.Collection = function (_EventEmitter) {
  _inherits(Collection, _EventEmitter);

  function Collection(name) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Collection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Collection).call(this));

    _this.options = options;
    _this._modelName = name;
    _this._writeQueue = new _PromiseQueue2.default(1);

    // Shorthand for defining in-memory collection
    if (options.inMemory) {
      options.cursorClass = options.cursorClass || _CursorObservable2.default;
      options.delegate = options.delegate || _CollectionDelegate2.default;
      options.storageManager = options.storageManager || _StorageManager2.default;
      options.indexManager = options.indexManager || _IndexManager2.default;
      options.idGenerator = options.idGenerator || _ShortIdGenerator2.default;
    }

    // Initialize collection only after configuration done
    Collection.startup(function () {
      return _this._lazyInitCollection();
    });
    return _this;
  }

  _createClass(Collection, [{
    key: 'create',

    /**
     * Factory for creating an object of the model
     * @param  {String|Object} raw
     * @return {Object}
     */
    value: function create(raw) {
      return _checkTypes2.default.string(raw) ? _EJSON2.default.parse(raw) : raw;
    }

    /**
     * Insert a document into the model and
     * emit `synd:insert` event (if not quiet).
     * @param  {Object} doc
     * @param  {Boolean} quiet
     * @return {Promise}
     */

  }, {
    key: 'insert',
    value: function insert(doc) {
      var _this2 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      var randomId = this.idGenerator(this.modelName);
      doc = this.create(doc);
      doc._id = doc._id || randomId.value;

      return this._writeQueue.add(function () {
        _this2.emit('beforeInsert', doc, randomId);
        if (!options.quiet) {
          _this2.emit('sync:insert', doc, randomId);
        }
        return _this2.delegate.insert(doc, options, randomId).then(function (docId) {
          _this2.emit('insert', doc, null, randomId);
          return docId;
        });
      });
    }

    /**
     * Just a sugar for mulpitle inserts. Wrap all inserts
     * with a single Promise and return it.
     * @param  {Array} docs
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: 'insertAll',
    value: function insertAll(docs) {
      var _this3 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return Promise.all((0, _map3.default)(docs, function (d) {
        return _this3.insert(d, options);
      }));
    }

    /**
     * Remove an object (or objects with options.multi)
     * from the model.
     * @param  {Object} query
     * @param  {Object} options
     * @param  {Boolean} quiet
     * @return {Promise}
     */

  }, {
    key: 'remove',
    value: function remove(query) {
      var _this4 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      return this._writeQueue.add(function () {
        _this4.emit('beforeRemove', query, options);
        if (!options.quiet) {
          _this4.emit('sync:remove', query, options);
        }
        return _this4.delegate.remove(query, options).then(function (removedDocs) {
          (0, _forEach2.default)(removedDocs, function (d) {
            return _this4.emit('remove', null, d);
          });
          return removedDocs;
        });
      });
    }

    /**
     * Remove an object (or objects with options.multi)
     * from the model.
     * NOTE: `upsert` is not supported, only `multi`
     * @param  {Object} query
     * @param  {Object} options
     * @param  {Boolean} quiet
     * @return {Promise}
     */

  }, {
    key: 'update',
    value: function update(query, modifier) {
      var _this5 = this;

      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      this._lazyInitCollection();
      return this._writeQueue.add(function () {
        _this5.emit('beforeUpdate', query, modifier, options);
        if (!options.quiet) {
          _this5.emit('sync:update', query, modifier, options);
        }
        return _this5.delegate.update(query, modifier, options).then(function (res) {
          (0, _forEach2.default)(res.updated, function (d, i) {
            _this5.emit('update', d, res.original[i]);
          });
          return res;
        });
      });
    }

    /**
     * Make a cursor with given query and return.
     * By default all documents clonned before passed
     * to pipeline functions. By setting `options.noClone`
     * to `true` clonning may be disabled (for your own risk)
     * @param  {Object} query
     * @param  {Number} options.noClone
     * @return {CursorObservable}
     */

  }, {
    key: 'find',
    value: function find(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      return this.delegate.find(query, options);
    }

    /**
     * Finds one object by given query and sort object.
     * Return a promise that resolved with a document object
     * or with undefined if no object found.
     * @param  {Object} query
     * @param  {Object} sortObj
     * @return {CursorObservable}
     */

  }, {
    key: 'findOne',
    value: function findOne(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      return this.delegate.findOne(query, options);
    }

    /**
     * Returns a number of matched by query objects. It's
     * based on `ids` function and uses only indexes.
     * In this case it's much more faster then doing
     * `find().length`, because it does not going to the
     * storage.
     * @param  {Object} query
     * @return {CursorObservable}
     */

  }, {
    key: 'count',
    value: function count(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      return this.delegate.count(query, options);
    }

    /**
     * Return a list of ids by given query. Uses only
     * indexes.
     * @param  {Object} query
     * @return {CursorObservable}
     */

  }, {
    key: 'ids',
    value: function ids(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this._lazyInitCollection();
      return this.delegate.ids(query, options);
    }

    /**
     * Initialize collection managers by stored options. It is
     * used for solving execution order problem of Collection
     * configuration functions.
     */

  }, {
    key: '_lazyInitCollection',
    value: function _lazyInitCollection() {
      if (!this._initialized) {
        var options = this.options;
        var storageManagerClass = options.storageManager || _defaultStorageManager;
        var delegateClass = options.delegate || _defaultDelegate;
        var indexManagerClass = options.indexManager || _defaultIndexManager;
        this.idGenerator = options.idGenerator || _defaultIdGenerator;
        this.cursorClass = options.cursorClass || _defaultCursor;
        this.indexManager = new indexManagerClass(this, options);
        this.storageManager = new storageManagerClass(this, options);
        this.delegate = new delegateClass(this, options);
        this._initialized = true;
      }
    }

    /**
     * Wihout arguments it returns current default storage manager.
     * If arguments provided, then first argument will be set as default
     * storage manager and all collections, who uses default storage manager,
     * will be upgraded to a new strage manager.
     * @return {undefined|Class}
     */

  }, {
    key: 'modelName',
    get: function get() {
      return this._modelName;
    }
  }, {
    key: 'indexes',
    get: function get() {
      this._lazyInitCollection();
      return this.indexManager.indexes;
    }
  }, {
    key: 'storage',
    get: function get() {
      this._lazyInitCollection();
      return this.storageManager;
    }
  }], [{
    key: 'defaultCursor',
    value: function defaultCursor() {
      if (arguments.length > 0) {
        _defaultCursor = arguments[0];
      } else {
        return _defaultCursor;
      }
    }

    /**
     * Wihout arguments it returns current default storage manager.
     * If arguments provided, then first argument will be set as default
     * storage manager and all collections, who uses default storage manager,
     * will be upgraded to a new strage manager.
     * @return {undefined|Class}
     */

  }, {
    key: 'defaultStorageManager',
    value: function defaultStorageManager() {
      if (arguments.length > 0) {
        _defaultStorageManager = arguments[0];
      } else {
        return _defaultStorageManager;
      }
    }

    /**
     * Wihout arguments it returns current default id generator.
     * If arguments provided, then first argument will be set as default
     * id generator and all collections, who uses default id generator,
     * will be upgraded to a new id generator.
     * @return {undefined|Class}
     */

  }, {
    key: 'defaultIdGenerator',
    value: function defaultIdGenerator() {
      if (arguments.length > 0) {
        _defaultIdGenerator = arguments[0];
      } else {
        return _defaultIdGenerator;
      }
    }

    /**
     * Wihout arguments it returns current default delegate class.
     * If arguments provided, then first argument will be set as default
     * delegate and all collections, who uses default delegate,
     * will be upgraded to a new delegate.
     * @return {undefined|Class}
     */

  }, {
    key: 'defaultDelegate',
    value: function defaultDelegate() {
      if (arguments.length > 0) {
        _defaultDelegate = arguments[0];
      } else {
        return _defaultDelegate;
      }
    }

    /**
     * Wihout arguments it returns current default index manager class.
     * If arguments provided, then first argument will be set as default
     * index manager and all collections, who uses default index manager,
     * will be upgraded to a new index manager.
     * @return {undefined|Class}
     */

  }, {
    key: 'defaultIndexManager',
    value: function defaultIndexManager() {
      if (arguments.length > 0) {
        _defaultIndexManager = arguments[0];
      } else {
        return _defaultIndexManager;
      }
    }

    /**
     * Execute some function after current execution cycle. For using fully
     * configured collection.
     * @param  {Function} fn
     * @return {Promise}
     */

  }, {
    key: 'startup',
    value: function startup(fn) {
      return Promise.resolve().then(fn);
    }
  }]);

  return Collection;
}(_AsyncEventEmitter2.default);

exports.default = Collection;