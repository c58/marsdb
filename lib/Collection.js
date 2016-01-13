import _each from 'fast.js/forEach';
import _map from 'fast.js/map';
import _check from 'check-types';
import EventEmitter from 'eventemitter3';
import invariant from 'invariant';
import DocumentModifier from './DocumentModifier';
import IndexManager from './IndexManager';
import StorageManager from './StorageManager';
import CursorObservable from './CursorObservable';
import Random from './Random';
import EJSON from './EJSON';


// Defaults
const _defaultRandomGenerator = new Random();
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
    this._methods = {};
    this._modelName = name;

    // Init managers
    const storageManagerClass = options.storageManager || _defaultStorageManager;
    this.cursorClass = options.cursorClass || _defaultCursorClass;
    this.indexManager = new IndexManager(this, options);
    this.storageManager = new storageManagerClass(this, options);
    this.idGenerator = options.idGenerator || _defaultIdGenerator;
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

  /**
   * Factory for creating an object of the model
   * @param  {String|Object} raw
   * @return {Object}
   */
  create(raw) {
    return _check.string(raw) ? EJSON.parse(raw) : raw;
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

    // Add to indexes and persist
    return this.indexManager.indexDocument(doc).then(() => {
      return this.storageManager.persist(doc._id, doc).then(() => {
        this.emit('insert', doc, null, randomId);
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
  insertAll(docs, options) {
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
    // Fire sync event
    if (!options.quiet) {
      this.emit('sync:remove', query, options);
    }

    // Remove locally
    return this.find(query).exec().then((docs) => {
      invariant(
        docs.length <= 1 || options.multi,
        'remove(..): multi removing is not enabled by options.multi'
      );

      const removeStorgePromises = _map(docs, d => {
        return this.storageManager.delete(d._id);
      });
      const removeIndexPromises = _map(docs, d => {
        return this.indexManager.deindexDocument(d);
      });
      const allPromises = removeStorgePromises.concat(removeIndexPromises);

      return Promise.all(allPromises).then(() => {
        _each(docs, d => this.emit('remove', null, d));
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
  update(query, modifier, options = {}) {
    options.upsert = false;

    // Fire sync event
    if (!options.quiet) {
      this.emit('sync:update', query, modifier, options);
    }

    // Update locally
    return new DocumentModifier(this, query)
      .modify(modifier, options)
      .then((result) => {
        var {original, updated} = result;
        updated = _map(updated, x => this.create(x));

        const updateStorgePromises = _map(updated, d => {
          return this.storageManager.persist(d._id, d);
        });
        const updateIndexPromises = _map(updated, (d, i) => {
          return this.indexManager.reindexDocument(original[i], d);
        });
        const allPromises = updateStorgePromises.concat(updateIndexPromises);

        return Promise.all(allPromises).then(() => {
          _each(updated, (d, i) => {
            this.emit('update', d, original[i]);
          });
          return {
            modified: updated.length,
            original: original,
            updated: updated,
          };
        });
      });
  }

  /**
   * Return all currently indexed ids
   * @return {Array}
   */
  getIndexIds() {
    return this.indexes._id.getAll();
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
    return new (this.cursorClass)(this, query, options);
  }

  /**
   * Finds one object by given query and sort object.
   * Return a promise that resolved with a document object
   * or with undefined if no object found.
   * @param  {Object} query
   * @param  {Object} sortObj
   * @return {CursorObservable}
   */
  findOne(query, sortObj, options = {}) {
    return this.find(query, options)
      .sort(sortObj).limit(1)
      .aggregate(docs => docs[0]);
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
    options.noClone = true;
    return this.find(query, options)
      .aggregate((docs) => docs.length);
  }

  /**
   * Return a list of ids by given query. Uses only
   * indexes.
   * @param  {Object} query
   * @return {CursorObservable}
   */
  ids(query, options = {}) {
    options.noClone = true;
    return this.find(query, options)
      .map((doc) => doc._id);
  }
}

export default Collection;
