import invariant from 'invariant';


export class CollectionIndex {
  constructor(keyName, options = {}) {
    invariant(
      keyName,
      'CollectionIndex(...): you must specify a field name for indexing'
    );
    invariant(
      !Array.isArray(keyName),
      'CollectionIndex(...): compound index is not supported yet'
    );

    this.keyName = keyName;
    this.unique = options.unique || false;
    this.sparse = options.sparse || false;

    this.reset();
  }

  reset() {
    // TODO
  }

  insert(doc) {
    // TODO
  }

  remove(doc) {
    // TODO
  }

  update(oldDoc, newDoc) {
    // TODO
  }

  getMatching(value) {
    // TODO
  }

  getBetweenBounds(query) {
    // TODO
  }

  getAll(options) {
    // TODO
  }
}

export default CollectionIndex;
