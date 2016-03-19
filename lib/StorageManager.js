import _keys from 'fast.js/object/keys';
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
  constructor(db, options = {}) {
    this.db = db;
    this.options = options;
    this._queue = new PromiseQueue(1);
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
    return this.loaded();
  }

  destroy() {
    return this.loaded().then(() => {
      this._storage = {};
    });
  }

  persist(key, value) {
    return this.loaded().then(() => {
      this._storage[key] = EJSON.clone(value);
    });
  }

  delete(key) {
    return this.loaded().then(() => {
      delete this._storage[key];
    });
  }

  get(key) {
    return this.loaded().then(() => this._storage[key]);
  }

  createReadStream(options = {}) {
    // Very limited subset of ReadableStream
    let paused = false;
    const emitter = new EventEmitter();
    emitter.pause = () => paused = true;

    this.loaded().then(() => {
      const keys = _keys(this._storage);
      for (let i = 0; i < keys.length; i++) {
        emitter.emit('data', { value: this._storage[keys[i]] });
        if (paused) {
          return;
        }
      }
      emitter.emit('end');
    });

    return emitter;
  }

  _loadStorage() {
    this._storage = {};
    return Promise.resolve();
  }
}

export default StorageManager;
