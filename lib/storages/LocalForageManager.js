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
      name: db.modelName,
    });
  }

  destroy() {
    return this._queue.add(() => {
      return Promise.all(Object.keys(this._storage).map(key => {
        return this.forage.removeItem(key);
      }))
      .then(() => super.destroy());
    });
  }

  persist(key, value) {
    return super.persist(key, value).then(() => {
      return this._queue.add(() => {
        return this.forage.setItem(key, EJSON.stringify(value));
      });
    });
  }

  delete(key) {
    return super.delete(key).then(() => {
      return this._queue.add(() => {
        return this.forage.removeItem(key);
      });
    });
  }

  _loadStorage() {
    return this._queue.add(() => {
      // TODO
    });
  }
}
