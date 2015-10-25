import _keys from 'lodash/object/keys';
import _defer from 'lodash/function/defer';
import EventEmitter from 'eventemitter3';
import PromiseQueue from './PromiseQueue';
import EJSON from './EJSON';


/**
 * Manager for dealing with backend storage
 * of the daatabase. Default implementation uses
 * memory. You can implement the same interface
 * and use another storage (with levelup, for example)
 */
export class StorageManager {
  constructor(db, options) {
    this.db = db;
    this._queue = new PromiseQueue();
    this._storage = {};
    this.reload();
  }

  loaded() {
    return this._loadedPromise;
  }

  reload() {
    if (this._loadedPromise) {
      this._loadedPromise = this._loadedPromise.then(() => {
        return this._loadStorage();
      });
    } else {
      this._loadedPromise = this._loadStorage();
    }
  }

  destroy() {
    return this._loadedPromise.then(() => {
      this._storage = {};
    });
  }

  persist(key, value) {
    return this._loadedPromise.then(() => {
      this._storage[key] = EJSON.clone(value);
    });
  }

  delete(key) {
    return this._loadedPromise.then(() => {
      delete this._storage[key];
    });
  }

  get(key) {
    return this._loadedPromise.then(() => {
      return EJSON.clone(this._storage[key]);
    });
  }

  createReadStream() {
    const emitter = new EventEmitter();
    _defer(() => {
      this._loadedPromise.then(() => {
        _keys(this._storage).forEach((k) => {
          emitter.emit('data', {value: EJSON.clone(this._storage[k])});
        });
        emitter.emit('end');
      });
    });
    return emitter;
  }

  _loadStorage() {
    return Promise.resolve();
  }
}

export default StorageManager;
