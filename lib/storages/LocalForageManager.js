const StorageManager = typeof window !== 'undefined' && window.Mars
  ? window.Mars.StorageManager : require('../StorageManager').default;
const EJSON = typeof window !== 'undefined' && window.Mars
  ? window.Mars.EJSON : require('../EJSON').default;
import localforage from 'localforage';


/**
 * LocalForage storage implementation. It uses
 * basic in-memory implementaion for fastest
 * iterating and just sync any operation with
 * a storage.
 */
export default class LocalForageManager extends StorageManager {
  constructor(db, options = {}) {
    super(db, options);
    this.forage = localforage.createInstance({
      name: db.modelName
    });
  }

  destroy() {
    return this._queue.push((resolve, reject) => {
      Promise.all(Object.keys(this._storage).map(key => {
        return this.forage.removeItem(key);
      }))
      .then(() => super.destroy())
      .then(resolve, reject);
    });
  }

  persist(key, value) {
    return super.persist(key, value).then(() => {
      return this._queue.push((resolve, reject) => {
        this.forage.setItem(key, EJSON.stringify(value))
          .then(resolve, reject);
      });
    });
  }

  delete(key) {
    return super.delete(key).then(() => {
      return this._queue.push((resolve, reject) => {
        this.forage.removeItem(key)
          .then(resolve, reject);
      });
    });
  }

  _loadStorage() {
    return this._queue.push((resolve, reject) => {
      // TODO
    });
  }
}
