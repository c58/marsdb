import _bind from 'fast.js/function/bind';
import _keys from 'fast.js/object/keys';
import _each from 'fast.js/forEach';
import _map from 'fast.js/map';
import invariant from 'invariant';
import PromiseQueue from './PromiseQueue';
import CollectionIndex from './CollectionIndex';
import DocumentRetriver from './DocumentRetriver';


/**
 * Manager for controlling a list of indexes
 * for some model. Building indexes is promise
 * based.
 * By default it creates an index for `_id` field.
 */
/* istanbul ignore next */
export class IndexManager {
  constructor(db, options = {}) {
    this.db = db;
    this.indexes = {};
    this._queue = new PromiseQueue(options.concurrency || 2);

    // By default ensure index by _id field
    this.ensureIndex({
      fieldName: '_id',
      unique: true,
    });
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
   * @param  {Object} options.fieldName     name of the field for indexing
   * @param  {Object} options.forceRebuild  rebuild index if it exists
   * @return {Promise}
   */
  ensureIndex(options) {
    invariant(
      options && options.fieldName,
      'You must specify a fieldName in options object'
    );

    const key = options.fieldName;
    if (!this.indexes[key]) {
      this.indexes[key] = new CollectionIndex(options);
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
   * Buld an existing index (ensured) and return a
   * promise that will be resolved only when index successfully
   * built for all documents in the storage.
   * @param  {String} key
   * @return {Promise}
   */
  buildIndex(key) {
    invariant(
      this.indexes[key],
      'Index with key `%s` does not ensured yet',
      key
    );

    const cleanup = () => this.indexes[key].buildPromise = null;
    const buildPromise = this._queue.add(
      _bind(this._doBuildIndex, this, key)
    ).then(cleanup, cleanup);

    this.indexes[key].buildPromise = buildPromise;
    return buildPromise;
  }

  /**
   * Schedule a task for each index in the
   * manager. Return promise that will be resolved
   * when all indexes is successfully built.
   * @return {Promise}
   */
  buildAllIndexes() {
    return Promise.all(
      _map(this.indexes, (v, k) => {
        return this.ensureIndex({
          fieldName: k,
          forceRebuild: true,
        });
      })
    );
  }

  /**
   * Remove an index
   * @param  {String} key
   * @return {Promise}
   */
  removeIndex(key) {
    return this._queue.add(() => {
      delete this.indexes[key];
    });
  }

  /**
   * Add a document to all indexes
   * @param  {Object} doc
   * @return {Promise}
   */
  indexDocument(doc) {
    return this._queue.add(() => {
      const keys = _keys(this.indexes);
      let failingIndex = null;
      try {
        _each(keys, (k, i) => {
          failingIndex = i;
          this.indexes[k].insert(doc);
        });
      } catch (e) {
        _each(keys.slice(0, failingIndex), (k) => {
          this.indexes[k].remove(doc);
        });
        throw e;
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
  reindexDocument(oldDoc, newDoc) {
    return this._queue.add(() => {
      const keys = _keys(this.indexes);
      let failingIndex = null;
      try {
        _each(keys, (k, i) => {
          failingIndex = i;
          this.indexes[k].update(oldDoc, newDoc);
        });
      } catch (e) {
        _each(keys.slice(0, failingIndex), (k) => {
          this.indexes[k].revertUpdate(oldDoc, newDoc);
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
  deindexDocument(doc) {
    return this._queue.add(() => {
      const keys = _keys(this.indexes);
      _each(keys, (k) => {
        this.indexes[k].remove(doc);
      });
    });
  }

  /**
   * Build an existing index with reseting first
   * @param  {String} key
   * @return {Promise}
   */
  _doBuildIndex(key) {
    // Get and reset index
    const index = this.indexes[key];
    index.reset();

    // Loop through all doucments in the storage
    const errors = [];
    return new DocumentRetriver(this.db)
    .retriveAll().then((docs) => {
      _each(docs, doc => {
        try {
          index.insert(doc);
        } catch (e) {
          errors.push([e, doc]);
        }
      });

      if (errors.length > 0) {
        throw new Error('Index build failed with errors: ', errors);
      }
    });
  }
}

export default IndexManager;
