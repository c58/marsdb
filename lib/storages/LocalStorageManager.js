const StorageManager = typeof window !== 'undefined' && window.Mars
  ? window.Mars.StorageManager : require('../StorageManager').default;
const EJSON = typeof window !== 'undefined' && window.Mars
  ? window.Mars.EJSON : require('../EJSON').default;


/**
 * LocalStorage storage implementation. It uses basic
 * in-memory StorageManager and sync all operations
 * with localStorage.
 */
export default class LocalStorageManager extends StorageManager {
  constructor(db, options = {}) {
    super(db, options);
  }

  destroy() {
    return this._queue.push((resolve, reject) => {
      Object.keys(this._storage).forEach(key => {
        localStorage.removeItem(this._makeStorageKey(key));
      });
      super.destroy().then(resolve, reject);
    });
  }

  persist(key, value) {
    return super.persist(key, value).then(() => {
      return this._queue.push((resolve, reject) => {
        localStorage.setItem(this._makeStorageKey(key), EJSON.stringify(value));
        resolve();
      });
    });
  }

  delete(key) {
    return super.delete(key).then(() => {
      return this._queue.push((resolve, reject) => {
        localStorage.removeItem(this._makeStorageKey(key));
        resolve();
      });
    });
  }

  _makeStorageKey(key = '') {
    return `mrs.${this.db.modelName}.${key}`;
  }

  _loadStorage() {
    return this._queue.push((resolve, reject) => {
      // Get keys of the collection
      const keyPrefix = this._makeStorageKey();
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.indexOf(keyPrefix) >= 0) {
          keys.push(storageKey);
        }
      }

      // Load data from storage
      keys.forEach((storageKey) => {
        const item = localStorage.getItem(storageKey);
        if (item) {
          const doc = this.db.create(item);
          this._storage[doc._id] = doc;
        }
      });

      resolve();
    });
  }
}
