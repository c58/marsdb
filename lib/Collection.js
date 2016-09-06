import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import _check from 'check-types';
import EventEmitter from './AsyncEventEmitter';
import IndexManager from './IndexManager';
import StorageManager from './StorageManager';
import CollectionDelegate from './CollectionDelegate';
import CursorObservable from './CursorObservable';
import ShortIdGenerator from './ShortIdGenerator';
import EJSON from './EJSON';


// Defaults
let _defaultCursor = CursorObservable;
let _defaultDelegate = CollectionDelegate;
let _defaultStorageManager = StorageManager;
let _defaultIndexManager = IndexManager;
let _defaultIdGenerator = ShortIdGenerator;


// Startup all init dependent functions on
// the second execution cycle
let _startedUp = false;
let _startUpQueue = [];
let _startUpId = 0;

// Internals
export function _resetStartup(waitMs = 0) {
  _startUpId += 1;
  _startUpQueue = [];
  _startedUp = false;
  const currStartId = _startUpId;
  setTimeout(() => {
    if (currStartId === _startUpId) {
      _startedUp = true;
      _each(_startUpQueue, fn => fn());
      _startUpQueue = [];
    }
  }, waitMs);
}

export function _warnIfAlreadyStarted() {
  if (_startedUp) {
    console.warn('You are trying to change some default of the Collection,' +
      'but all collections is already initialized. It may be happened ' +
      'because you are trying to configure Collection not at first ' +
      'execution cycle of main script. Please consider to move all ' +
      'configuration to first execution cycle.');
  }
}

// Initiate startup
_resetStartup();

/**
 * Core class of the database.
 * It delegates almost all it's methods to managers
 * and emits events for live queries and other cuctomisation.
 */
export class Collection extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.options = options;
    this._modelName = name;

    // Shorthand for defining in-memory collection
    if (options.inMemory) {
      options.cursorClass = options.cursorClass || CursorObservable;
      options.delegate = options.delegate || CollectionDelegate;
      options.storageManager = options.storageManager || StorageManager;
      options.indexManager = options.indexManager || IndexManager;
      options.idGenerator = options.idGenerator || ShortIdGenerator;
    }

    // Initialize collection only after configuration done
    Collection.startup(() => this._lazyInitCollection());
  }

  get modelName() {
    return this._modelName;
  }
  get indexes() {
    this._lazyInitCollection();
    return this.indexManager.indexes;
  }
  get storage() {
    this._lazyInitCollection();
    return this.storageManager;
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
    this._lazyInitCollection();
    const randomId = this.idGenerator(this.modelName);
    doc = this.create(doc);
    doc._id = doc._id || randomId.value;

    this.emit('beforeInsert', doc, randomId);
    if (!options.quiet) {
      this.emit('sync:insert', doc, randomId);
    }
    return this.delegate.insert(doc, options, randomId).then((docId) => {
      this.emit('insert', doc, null, randomId);
      return docId;
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
    this._lazyInitCollection();

    this.emit('beforeRemove', query, options);
    if (!options.quiet) {
      this.emit('sync:remove', query, options);
    }
    return this.delegate.remove(query, options).then((removedDocs) => {
      _each(removedDocs, d => this.emit('remove', null, d));
      return removedDocs;
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
    this._lazyInitCollection();

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
  findOne(query, options = {}) {
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
  count(query, options = {}) {
    this._lazyInitCollection();
    return this.delegate.count(query, options);
  }

  /**
   * Return a list of ids by given query. Uses only
   * indexes.
   * @param  {Object} query
   * @return {CursorObservable}
   */
  ids(query, options = {}) {
    this._lazyInitCollection();
    return this.delegate.ids(query, options);
  }

  /**
   * Initialize collection managers by stored options. It is
   * used for solving execution order problem of Collection
   * configuration functions.
   */
  _lazyInitCollection() {
    if (!this._initialized) {
      this._initialized = true;
      const options = this.options;
      const storageManagerClass = options.storageManager || _defaultStorageManager;
      const delegateClass = options.delegate || _defaultDelegate;
      const indexManagerClass = options.indexManager || _defaultIndexManager;
      this.idGenerator = options.idGenerator || _defaultIdGenerator;
      this.cursorClass = options.cursorClass || _defaultCursor;
      this.indexManager = new indexManagerClass(this, options);
      this.storageManager = new storageManagerClass(this, options);
      this.delegate = new delegateClass(this, options);
    }
  }

  /**
   * Wihout arguments it returns current default storage manager.
   * If arguments provided, then first argument will be set as default
   * storage manager and all collections, who uses default storage manager,
   * will be upgraded to a new strage manager.
   * @return {undefined|Class}
   */
  static defaultCursor() {
    if (arguments.length > 0) {
      _warnIfAlreadyStarted();
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
  static defaultStorageManager() {
    if (arguments.length > 0) {
      _warnIfAlreadyStarted();
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
  static defaultIdGenerator() {
    if (arguments.length > 0) {
      _warnIfAlreadyStarted();
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
  static defaultDelegate() {
    if (arguments.length > 0) {
      _warnIfAlreadyStarted();
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
  static defaultIndexManager() {
    if (arguments.length > 0) {
      _warnIfAlreadyStarted();
      _defaultIndexManager = arguments[0];
    } else {
      return _defaultIndexManager;
    }
  }

  /**
   * Execute some function after current execution cycle. For using fully
   * configured collection.
   * @param  {Function} fn
   */
  static startup(fn) {
    if (_startedUp) {
      fn();
    } else {
      _startUpQueue.push(fn);
    }
  }
}

export default Collection;
