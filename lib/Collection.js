import _map from 'fast.js/map';
import _each from 'fast.js/forEach';
import _check from 'check-types';
import EventEmitter from 'eventemitter3';
import IndexManager from './IndexManager';
import StorageManager from './StorageManager';
import CursorObservable from './CursorObservable';
import CollectionDelegate from './CollectionDelegate';
import Random from './Random';
import EJSON from './EJSON';


// Defaults
const _defaultRandomGenerator = new Random();
let _defaultDelegate = CollectionDelegate;
let _defaultCursorClass = CursorObservable;
let _defaultStorageManager = StorageManager;
let _defaultIdGenerator = function(modelName) {
  const nextSeed = _defaultRandomGenerator.hexString(20);
  const sequenceSeed = [nextSeed, `/collection/${modelName}`];
  return {
    value: Random.createWithSeed.apply(null, sequenceSeed).id(17),
    seed: nextSeed,
  };
};


export class Collection extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this._modelName = name;

    const storageManagerClass = options.storageManager || _defaultStorageManager;
    const delegateClass = options.delegate || _defaultDelegate;
    this.cursorClass = options.cursorClass || _defaultCursorClass;
    this.indexManager = new IndexManager(this, options);
    this.storageManager = new storageManagerClass(this, options);
    this.idGenerator = options.idGenerator || _defaultIdGenerator;
    this.delegate = new delegateClass(this, options);
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

  static defaultStorageManager() {
    if (arguments.length > 0) {
      _defaultStorageManager = arguments[0];
    } else {
      return _defaultStorageManager;
    }
  }

  static defaultIdGenerator() {
    if (arguments.length > 0) {
      _defaultIdGenerator = arguments[0];
    } else {
      return _defaultIdGenerator;
    }
  }

  static defaultCursorClass() {
    if (arguments.length > 0) {
      _defaultCursorClass = arguments[0];
    } else {
      return _defaultCursorClass;
    }
  }

  static defaultDelegate() {
    if (arguments.length > 0) {
      _defaultDelegate = arguments[0];
    } else {
      return _defaultDelegate;
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
   * Return all currently indexed ids
   * @return {Array}
   */
  getIndexIds() {
    return this.indexes._id.getAll();
  }

  /**
   * Ensures index by delegating to IndexManager.
   * @param  {String} key
   * @return {Promise}
   */
  ensureIndex(key) {
    return this.indexManager.ensureIndex(key);
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

    // Fire sync event
    if (!options.quiet) {
      this.emit('sync:insert', doc, randomId);
    }

    return this.delegate.insert(doc, options).then((docId) => {
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
}

export default Collection;
