'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Collection = undefined;

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _DocumentModifier = require('./DocumentModifier');

var _DocumentModifier2 = _interopRequireDefault(_DocumentModifier);

var _IndexManager = require('./IndexManager');

var _IndexManager2 = _interopRequireDefault(_IndexManager);

var _StorageManager = require('./StorageManager');

var _StorageManager2 = _interopRequireDefault(_StorageManager);

var _CursorObservable = require('./CursorObservable');

var _CursorObservable2 = _interopRequireDefault(_CursorObservable);

var _Random = require('./Random');

var _Random2 = _interopRequireDefault(_Random);

var _Document = require('./Document');

var _Document2 = _interopRequireDefault(_Document);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Defaults
var _defaultRandomGenerator = new _Random2.default();
var _defaultCursorClass = _CursorObservable2.default;
var _defaultStorageManager = _StorageManager2.default;
var _defaultIdGenerator = function _defaultIdGenerator(modelName) {
  var nextSeed = _defaultRandomGenerator.hexString(20);
  var sequenceSeed = [nextSeed, '/collection/' + modelName];
  return {
    value: _Random2.default.createWithSeed.apply(null, sequenceSeed).id(17),
    seed: nextSeed
  };
};

var Collection = exports.Collection = (function (_EventEmitter) {
  _inherits(Collection, _EventEmitter);

  function Collection(name) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Collection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Collection).call(this));

    _this._methods = {};
    _this._modelName = name;

    // Init managers
    var storageManagerClass = options.storageManager || _defaultStorageManager;
    _this.indexManager = new _IndexManager2.default(_this, options);
    _this.storageManager = new storageManagerClass(_this, options);
    _this.idGenerator = options.idGenerator || _defaultIdGenerator;
    return _this;
  }

  _createClass(Collection, [{
    key: 'create',

    /**
     * Factory for creating an object of the model
     * @param  {String|Object} raw
     * @return {Document}
     */
    value: function create(raw) {
      return new _Document2.default(this, raw);
    }

    /**
     * Set a static function in a model. Chainable.
     * @param  {String}   name
     * @param  {Function} fn
     * @return {this}
     */

  }, {
    key: 'static',
    value: function _static(name, fn) {
      (0, _invariant2.default)(!Collection.prototype.hasOwnProperty(name) && typeof fn === 'function', 'Static function `%s` must not be an existing one in a model', name);
      this[name] = fn;
      return this;
    }

    /**
     * Setup a method in a model (all created documents).
     * Chainable.
     * @param  {String}   name
     * @param  {Function} fn
     * @return {this}
     */

  }, {
    key: 'method',
    value: function method(name, fn) {
      (0, _invariant2.default)(!this._methods[name] && typeof fn === 'function', 'Method function `%s` already defined in a model', name);
      this._methods[name] = fn;
      return this;
    }

    /**
     * Ensures index by delegating to IndexManager.
     * @param  {String} key
     * @return {Promise}
     */

  }, {
    key: 'ensureIndex',
    value: function ensureIndex(key) {
      return this.indexManager.ensureIndex(key);
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

      // Fire sync event
      if (!options.quiet) {
        this.emit('sync:insert', doc, randomId);
      }

      // Add to indexes and persist
      return this.indexManager.indexDocument(doc).then(function () {
        return _this2.storageManager.persist(doc._id, doc).then(function () {
          _this2.emit('insert', doc, null, randomId);
          return doc._id;
        });
      });
    }

    /**
     * Insert all documents in given list
     * @param  {Array} docs
     * @param  {Boolean} quiet
     * @return {Promise}
     */

  }, {
    key: 'insertAll',
    value: function insertAll(docs, options) {
      var _this3 = this;

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

      // Fire sync event
      if (!options.quiet) {
        this.emit('sync:remove', query, options);
      }

      // Remove locally
      return this.find(query).exec().then(function (docs) {
        (0, _invariant2.default)(docs.length <= 1 || options.multi, 'remove(..): multi removing is not enabled by options.multi');

        var removeStorgePromises = (0, _map3.default)(docs, function (d) {
          return _this4.storageManager.delete(d._id);
        });
        var removeIndexPromises = (0, _map3.default)(docs, function (d) {
          return _this4.indexManager.deindexDocument(d);
        });
        var allPromises = removeStorgePromises.concat(removeIndexPromises);

        return Promise.all(allPromises).then(function () {
          (0, _forEach2.default)(docs, function (d) {
            return _this4.emit('remove', null, d);
          });
          return docs;
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

      options.upsert = false;

      // Fire sync event
      if (!options.quiet) {
        this.emit('sync:update', query, modifier, options);
      }

      // Update locally
      return new _DocumentModifier2.default(this, query).modify(modifier, options).then(function (result) {
        var original = result.original;
        var updated = result.updated;

        updated = (0, _map3.default)(updated, function (x) {
          return _this5.create(x);
        });

        var updateStorgePromises = (0, _map3.default)(updated, function (d) {
          return _this5.storageManager.persist(d._id, d);
        });
        var updateIndexPromises = (0, _map3.default)(updated, function (d, i) {
          return _this5.indexManager.reindexDocument(original[i], d);
        });
        var allPromises = updateStorgePromises.concat(updateIndexPromises);

        return Promise.all(allPromises).then(function () {
          (0, _forEach2.default)(updated, function (d, i) {
            _this5.emit('update', d, original[i]);
          });
          return {
            modified: updated.length,
            original: original,
            updated: updated
          };
        });
      });
    }

    /**
     * Return all currently indexed ids
     * @return {Array}
     */

  }, {
    key: 'getIndexIds',
    value: function getIndexIds() {
      return this.indexes._id.getAll();
    }

    /**
     * Make a cursor with given query and return
     * @param  {Object} query
     * @return {CursorObservable}
     */

  }, {
    key: 'find',
    value: function find(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return new _defaultCursorClass(this, query, options);
    }

    /**
     * Finds one object by given query and sort object.
     * Return a promise that resolved with a document object
     * or with undefined if no object found.
     * @param  {Object} query
     * @param  {Object} sortObj
     * @return {Promise}
     */

  }, {
    key: 'findOne',
    value: function findOne(query, sortObj) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      return this.find(query, options).sort(sortObj).limit(1).aggregate(function (docs) {
        return docs[0];
      });
    }

    /**
     * Returns a number of matched by query objects. It's
     * based on `ids` function and uses only indexes.
     * In this case it's much more faster then doing
     * `find().length`, because it does not going to the
     * storage.
     * @param  {Object} query
     * @return {Promise}
     */

  }, {
    key: 'count',
    value: function count(query) {
      return this.ids(query).then(function (ids) {
        return ids.length;
      });
    }

    /**
     * Return a list of ids by given query. Uses only
     * indexes.
     * @param  {Object} query
     * @return {Promise}
     */

  }, {
    key: 'ids',
    value: function ids(query) {
      return new _defaultCursorClass(this, query).ids();
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
  }], [{
    key: 'defaultStorageManager',
    value: function defaultStorageManager(managerClass) {
      _defaultStorageManager = managerClass;
    }
  }, {
    key: 'defaultIdGenerator',
    value: function defaultIdGenerator(generator) {
      _defaultIdGenerator = generator;
    }
  }, {
    key: 'defaultCursorClass',
    value: function defaultCursorClass(cursorClass) {
      _defaultCursorClass = cursorClass;
    }
  }]);

  return Collection;
})(_eventemitter2.default);

exports.default = Collection;