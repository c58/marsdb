import invariant from 'invariant';


export class CollectionIndex {
  constructor(options = {}) {
    invariant(
      options.fieldName,
      'CollectionIndex(...): you must specify a "feildName" option'
    );
    invariant(
      !Array.isArray(options.fieldName),
      'CollectionIndex(...): compound index is not supported yet'
    );

    this.fieldName = options.fieldName;
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
