import invariant from 'invariant';
import CollectionIndex from './CollectionIndex';
import { makeLookupFunction } from './DocumentMatcher';


export class MapIndex extends CollectionIndex {
  constructor(keyName, options = {}) {
    super(keyName, options);

    this.mapIndex = new Map();
    this.lookupFunction = makeLookupFunction(keyName);
  }

  reset() {
    this.mapIndex.clear();
  }

  insert(doc) {
    const valueKey = this.lookupFunction(doc)[0].value;
    this._checkRequiredIdField(doc);

    if (doc._id && valueKey) {
      if (valueKey instanceof Date
        || typeof valueKey === 'number'
        || typeof valueKey === 'string')
      {
        const mpIdx = this.mapIndex;
        if (this.unique) {
          const isMapHasProp = mpIdx.has(valueKey);
          if (isMapHasProp) {
            throw new Error('CollectionIndex(...): document ' +
              `with "${this.keyName}: ${valueKey}" must be unique`);
          } else {
            mpIdx.set(valueKey, [doc._id]);
          }
        } else {
          const val = mpIdx.get(valueKey) || [];
          mpIdx.set(valueKey, val);
          if (mpIdx.get(valueKey).indexOf(doc._id) === -1) {
            let arr = mpIdx.get(valueKey);
            arr.push(doc._id);
            mpIdx.set(valueKey, arr);
          }
        }
      } else {
        throw new Error(`CollectionIndex(...): ${typeof valueKey} type ` +
          'of index is not supported yet. It can be String, Number, Date.');
      }
    }
  }

  remove(doc) {
    const valueKey = this.lookupFunction(doc)[0].value;
    this._checkRequiredIdField(doc);

    let mpIdx = this.mapIndex;

    if (doc._id && valueKey) {
      if (this.unique) {
        mpIdx.delete(valueKey);
      } else {
        let val = mpIdx.get(valueKey);
        const idx = val.indexOf(doc._id);
        if (idx !== -1) {
          val.splice(idx, 1);
          mpIdx.set(valueKey, val);
        }
      }
    }
  }

  update(oldDoc, newDoc) {
    invariant(
      oldDoc._id === newDoc._id,
      'CollectionIndex(...): old and new documents ' +
      'must have the same "_id" when doing update'
    );

    const valueKeyOld = this.lookupFunction(oldDoc)[0].value;
    const valueKeyNew = this.lookupFunction(newDoc)[0].value;

    const mpIdx = this.mapIndex;
    var idxOld = -1;
    var idxNew = -1;

    if (valueKeyOld && mpIdx.get(valueKeyOld)) {
      idxOld = mpIdx.get(valueKeyOld).indexOf(oldDoc._id);
    }

    if (valueKeyNew && mpIdx.get(valueKeyNew)) {
      idxNew = mpIdx.get(valueKeyNew).indexOf(newDoc._id);
    }

    if (idxOld !== -1 && idxNew !== -1) {
      if (valueKeyOld !== valueKeyNew) {
        this.remove(oldDoc);
        this.insert(newDoc);
      } else {
        // Do nothing
      }
    } else if (idxOld !== -1 && idxNew === -1) {
      this.remove(oldDoc);
      this.insert(newDoc);
    } else if (idxOld === -1 && idxNew !== -1) {
      // Do nothing
    } else if (idxOld === -1 && idxNew === -1) {
      this.insert(newDoc);
    }

  }

  revertUpdate(oldDoc, newDoc) {
    this.update(newDoc, oldDoc);
  }

  getMatching(value) {
    return this.mapIndex.get(value) || this.getAll();
  }

  getBetweenBounds(query) {
    // TODO
  }

  getAll(options) {
    var all = [];
    for (let val of this.mapIndex.values()) {
      all = all.concat(val);
    }
    return all;
  }

  _checkRequiredIdField(doc) {
    invariant(
      doc._id !== undefined && doc._id !== null,
      `CollectionIndex(...): document ${doc} must has field "_id", but hasn't`
    );
  }

}

export default MapIndex;
