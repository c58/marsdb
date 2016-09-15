import invariant from 'invariant';
import CollectionIndex from './CollectionIndex';
import { makeLookupFunction } from './DocumentMatcher';
import _indexOf from 'fast.js/array/indexOf';
import _concat from 'fast.js/array/concat';


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
    if (doc.hasOwnProperty(this.keyName)) {
      if (valueKey instanceof Date
        || typeof valueKey === 'number'
        || typeof valueKey === 'string'
        || valueKey === null
        || valueKey === undefined)
      {
        let mpIdx = this.mapIndex;
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
          if (_indexOf(mpIdx.get(valueKey), doc._id) === -1) {
            let arr = mpIdx.get(valueKey);
            arr.push(doc._id);
            mpIdx.set(valueKey, arr);
          }
        }
      } else {
        throw new Error(`CollectionIndex(...): ${typeof valueKey} type ` +
          'of index is not supported yet. It must be String, Number, Date.');
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
        const idx = _indexOf(val, doc._id);
        if (idx !== -1) {
          val.splice(idx, 1);
          if (val.length) {
            mpIdx.set(valueKey, val);
          } else {
            mpIdx.delete(valueKey);
          }
        }
      }
    }
  }

  update(oldDoc, newDoc, revert) {
    if (oldDoc && newDoc) {
      invariant(
         oldDoc._id === newDoc._id,
        'CollectionIndex(...): old and new documents ' +
        'must have the same "_id" when doing update'
      );
    }

    const valueKeyOld = oldDoc ? this.lookupFunction(oldDoc)[0].value : null;
    const valueKeyNew = newDoc ? this.lookupFunction(newDoc)[0].value : null;

    const mpIdx = this.mapIndex;
    var idxOld = -1;
    var idxNew = -1;

    const itemsByOldKey = mpIdx.get(valueKeyOld);
    if (oldDoc && itemsByOldKey) {
      idxOld = _indexOf(itemsByOldKey, oldDoc._id);
    }

    const itemsByNewKey = mpIdx.get(valueKeyNew);
    if (newDoc && itemsByNewKey) {
      idxNew = _indexOf(itemsByNewKey, newDoc._id);
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
        if (newDoc) {
          this.insert(newDoc);
        }
    } else if (idxOld === -1 && idxNew !== -1) {
      if (revert) {
        this.remove(oldDoc);
      } else {
        // Do nothing
      }
    } else if (idxOld === -1 && idxNew === -1 && newDoc) {
      this.insert(newDoc);
    }

  }

  revertUpdate(oldDoc, newDoc) {
    this.update(newDoc, oldDoc, true);
  }

  getMatching(value) {
    return this.mapIndex.get(value) || this.getAll();
  }

  getBetweenBounds(query) {
    // TODO
  }

  getAll(options) {
    let result = [];
    for (let itm of this.mapIndex.values()) {
      result = _concat(result, itm);
    }
    return result;
  }

  _checkRequiredIdField(doc) {
    invariant(
      doc._id !== undefined && doc._id !== null,
      `CollectionIndex(...): document ${doc} must has field "_id", but hasn't`
    );
  }

}

export default MapIndex;
