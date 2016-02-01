import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import _check from 'check-types';
import EventEmitter from 'eventemitter3';
import IndexManager from './IndexManager';
import PromiseQueue from './PromiseQueue';
import StorageManager from './StorageManager';
import CollectionDelegate from './CollectionDelegate';
import Random from './Random';
import EJSON from './EJSON';


// Defaults
const _defaultUpgradeEmitter = new EventEmitter();
let _defaultDelegate = CollectionDelegate;
let _defaultStorageManager = StorageManager;
let _defaultIndexManager = IndexManager;
let _defaultIdGenerator = function(modelName) {
  const nextSeed = Random.default().hexString(20);
  const sequenceSeed = [nextSeed, `/collection/${modelName}`];
  return {
    value: Random.createWithSeeds.apply(null, sequenceSeed).id(17),
    seed: nextSeed,
  };
};


export class Collection extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this._modelName = name;
    this._writeQueue = new PromiseQueue(options.writeConcurrency || 5);

    const storageManagerClass = options.storageManager || _defaultStorageManager;
    const delegateClass = options.delegate || _defaultDelegate;
    const indexManagerClass = options.indexManager || _defaultIndexManager;
    this.idGenerator = options.idGenerator || _defaultIdGenerator;
    this.indexManager = new indexManagerClass(this, options);
    this.storageManager = new storageManagerClass(this, options);
    this.delegate = new delegateClass(this, options);

    if (options.upgradeDefaults) {
      this._registerDefaultUpgradeHandlers(options);
    }
  }

  get modelName() {
    return this._modelName;
  }
  get indexes() {
    return this.indexManager.indexes;
  }
  get storage() {
    return this.storageManager;
  }

  /**
   * Wihout arguments it returns current default storage manager.
   * If arguments provided, then first argument will be set as default
   * storage manager and all collections, who uses default storage manager,
   * will be upgraded to a new strage manager.
   * @return {undefined|Class}
   */
  static defaultStorageManager() {
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
  static defaultIdGenerator() {
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
  static defaultDelegate() {
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
  static defaultIndexManager() {
    if (arguments.length > 0) {
      _defaultIndexManager = arguments[0];
      _defaultUpgradeEmitter.emit('indexManager');
    } else {
      return _defaultIndexManager;
    }
  }

  /**
   * Factory for creating an object of the model
   * @param  {String|Object} raw
   * @return {Object}
   */
  create(raw) {
    return _check.string(raw) ? EJSON.parse(raw) : raw;
  }

  /**
   * Insert a document into the model and
   * emit `synd:insert` event (if not quiet).
   * @param  {Object} doc
   * @param  {Boolean} quiet
   * @return {Promise}
   */
  insert(doc, options = {}) {
    // Prepare document for insertion
    const randomId = this.idGenerator(this.modelName);
    doc = this.create(doc);
    doc._id = doc._id || randomId.value;

    return this._writeQueue.add(() => {
      this.emit('beforeInsert', doc, randomId);
      if (!options.quiet) {
        this.emit('sync:insert', doc, randomId);
      }
      return this.delegate.insert(doc, options, randomId).then((docId) => {
        this.emit('insert', doc, null, randomId);
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
  insertAll(docs, options = {}) {
    return Promise.all(
      _map(docs, d => this.insert(d, options))
    );
  }

  /**
   * Remove an object (or objects with options.multi)
   * from the model.
   * @param  {Object} query
   * @param  {Object} options
   * @param  {Boolean} quiet
   * @return {Promise}
   */
  remove(query, options = {}) {
    return this._writeQueue.add(() => {
      this.emit('beforeRemove', query, options);
      if (!options.quiet) {
        this.emit('sync:remove', query, options);
      }
      return this.delegate.remove(query, options).then((removedDocs) => {
        _each(removedDocs, d => this.emit('remove', null, d));
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
  update(query, modifier, options = {}) {
    return this._writeQueue.add(() => {
      this.emit('beforeUpdate', query, modifier, options);
      if (!options.quiet) {
        this.emit('sync:update', query, modifier, options);
      }
      return this.delegate.update(query, modifier, options).then(res => {
        _each(res.updated, (d, i) => {
          this.emit('update', d, res.original[i]);
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
  find(query, options = {}) {
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
  findOne(query, options = {}) {
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
  count(query, options = {}) {
    return this.delegate.count(query, options);
  }

  /**
   * Return a list of ids by given query. Uses only
   * indexes.
   * @param  {Object} query
   * @return {CursorObservable}
   */
  ids(query, options = {}) {
    return this.delegate.ids(query, options);
  }

  /**
   * If defaults is not overrided by options, then collection
   * registered in evenbus for default upgrade. This behaviour
   * is optional and may be enabled by special constructor
   * option.
   * @param  {Object} options
   */
  _registerDefaultUpgradeHandlers(options = {}) {
    if (!options.storageManager) {
      _defaultUpgradeEmitter.on('storageManager', () =>
        this.storageManager = new _defaultStorageManager(this, options)
      );
    }
    if (!options.idGenerator) {
      _defaultUpgradeEmitter.on('idGenerator', () =>
        this.idGenerator = _defaultIdGenerator
      );
    }
    if (!options.delegate) {
      _defaultUpgradeEmitter.on('delegate', () =>
        this.delegate = new _defaultDelegate(this, options)
      );
    }
    if (!options.indexManager) {
      _defaultUpgradeEmitter.on('indexManager', () =>
        this.indexManager = new _defaultIndexManager(this, options)
      );
    }
  }
}

export default Collection;
