import AngularCursorObservable from './AngularCursorObservable';
const Collection = typeof window !== 'undefined' && window.Mars
  ? window.Mars.Collection : require('../Collection').default;


/**
 * Collection that just delegate all methods to an
 * original Collection and wrapps all returned promises
 * with angular's $q.
 *
 * It's not extending an original Collection for
 * safity porpuse. But if you really wants to access
 * storage or indexes, use a '_collcetion' field
 * of the object.
 */
export class AngularCollection {
  constructor(name, options, $q) {
    this.$q = $q;
    this._collection = new Collection(name, options);
  }

  get modelName() {
    return this._collection.modelName;
  }

  ensureIndex(...args) {
    return this.$q.resolve(this._collection.ensureIndex(...args));
  }

  insert(...args) {
    return this.$q.resolve(this._collection.insert(...args));
  }

  insertAll(...args) {
    return this.$q.resolve(this._collection.insertAll(...args));
  }

  update(...args) {
    return this.$q.resolve(this._collection.update(...args));
  }

  remove(...args) {
    return this.$q.resolve(this._collection.remove(...args));
  }

  find(query) {
    return new AngularCursorObservable(this, query);
  }

  findOne(...args) {
    return this.$q.resolve(this._collection.findOne(...args));
  }

  count(...args) {
    return this.$q.resolve(this._collection.count(...args));
  }

  ids(...args) {
    return this.$q.resolve(this._collection.ids(...args));
  }
}

export default AngularCollection;
