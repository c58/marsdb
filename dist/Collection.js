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

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

var _IndexManager = require('./IndexManager');

var _IndexManager2 = _interopRequireDefault(_IndexManager);

var _PromiseQueue = require('./PromiseQueue');

var _PromiseQueue2 = _interopRequireDefault(_PromiseQueue);

var _StorageManager = require('./StorageManager');

var _StorageManager2 = _interopRequireDefault(_StorageManager);

var _CollectionDelegate = require('./CollectionDelegate');

var _CollectionDelegate2 = _interopRequireDefault(_CollectionDelegate);

var _Random = require('./Random');

var _Random2 = _interopRequireDefault(_Random);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Defaults
var _defaultUpgradeEmitter = new _eventemitter2.default();
var _defaultDelegate = _CollectionDelegate2.default;
var _defaultStorageManager = _StorageManager2.default;
var _defaultIndexManager = _IndexManager2.default;
var _defaultIdGenerator = function _defaultIdGenerator(modelName) {
  var nextSeed = _Random2.default.default().hexString(20);
  var sequenceSeed = [nextSeed, '/collection/' + modelName];
  return {
    value: _Random2.default.createWithSeeds.apply(null, sequenceSeed).id(17),
    seed: nextSeed
  };
};

var Collection = exports.Collection = function (_EventEmitter) {
  _inherits(Collection, _EventEmitter);

  function Collection(name) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Collection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Collection).call(this));

    _this._modelName = name;
    _this._writeQueue = new _PromiseQueue2.default(options.writeConcurrency || 5);

    var storageManagerClass = options.storageManager || _defaultStorageManager;
    var delegateClass = options.delegate || _defaultDelegate;
    var indexManagerClass = options.indexManager || _defaultIndexManager;
    _this.idGenerator = options.idGenerator || _defaultIdGenerator;
    _this.indexManager = new indexManagerClass(_this, options);
    _this.storageManager = new storageManagerClass(_this, options);
    _this.delegate = new delegateClass(_this, options);

    if (options.upgradeDefaults) {
      _this._registerDefaultUpgradeHandlers(options);
    }
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

      // Prepare document for insertion
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

      return this.delegate.ids(query, options);
    }

    /**
     * If defaults is not overrided by options, then collection
     * registered in evenbus for default upgrade. This behaviour
     * is optional and may be enabled by special constructor
     * option.
     * @param  {Object} options
     */

  }, {
    key: '_registerDefaultUpgradeHandlers',
    value: function _registerDefaultUpgradeHandlers() {
      var _this6 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (!options.storageManager) {
        _defaultUpgradeEmitter.on('storageManager', function () {
          return _this6.storageManager = new _defaultStorageManager(_this6, options);
        });
      }
      if (!options.idGenerator) {
        _defaultUpgradeEmitter.on('idGenerator', function () {
          return _this6.idGenerator = _defaultIdGenerator;
        });
      }
      if (!options.delegate) {
        _defaultUpgradeEmitter.on('delegate', function () {
          return _this6.delegate = new _defaultDelegate(_this6, options);
        });
      }
      if (!options.indexManager) {
        _defaultUpgradeEmitter.on('indexManager', function () {
          return _this6.indexManager = new _defaultIndexManager(_this6, options);
        });
      }
    }
  }, {
    key: 'modelName',
    get: function get() {
      return this._modelName;
    }
  }, {
    key: 'indexes',
    get: function get() {
      return this.indexManager.indexes;
    }
  }, {
    key: 'storage',
    get: function get() {
      return this.storageManager;
    }

    /**
     * Wihout arguments it returns current default storage manager.
     * If arguments provided, then first argument will be set as default
     * storage manager and all collections, who uses default storage manager,
     * will be upgraded to a new strage manager.
     * @return {undefined|Class}
     */

  }], [{
    key: 'defaultStorageManager',
    value: function defaultStorageManager() {
      if (arguments.length > 0) {
        _defaultStorageManager = arguments[0];
        _defaultUpgradeEmitter.emit('storageManager');
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
        _defaultUpgradeEmitter.emit('idGenerator');
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
        _defaultUpgradeEmitter.emit('delegate');
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
        _defaultUpgradeEmitter.emit('indexManager');
      } else {
        return _defaultIndexManager;
      }
    }
  }]);

  return Collection;
}(_eventemitter2.default);

exports.default = Collection;