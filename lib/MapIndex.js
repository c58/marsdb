import invariant from 'invariant';
import CollectionIndex from './CollectionIndex';
import { makeLookupFunction } from './DocumentMatcher';


export class MapIndex extends CollectionIndex {
  constructor(keyName, options = {}) {
    super(keyName, options);

    this.mapIndex = {};
    this.lookupFunction = makeLookupFunction(keyName);
  }

  reset() {
    this.mapIndex = {};
  }

  insert(doc) {
    const valueKey = this.lookupFunction(doc)[0].value;
    this._checkRequiredFields(doc, valueKey);
    if (doc._id && valueKey) {
      if (valueKey instanceof Date
        || typeof valueKey === 'number'
        || typeof valueKey === 'string')
      {
        const mpIdx = this.mapIndex;
        if (this.unique) {
          const isMapHasProp = mpIdx.hasOwnProperty(valueKey);
          if (isMapHasProp) {
            throw new Error('CollectionIndex(...): document ' +
              `with "${this.keyName}: ${valueKey}" must be unique`);
          } else {
            mpIdx[valueKey] = [doc._id];
          }
        } else {
          mpIdx[valueKey] = mpIdx[valueKey] || [];
          if (mpIdx[valueKey].indexOf(doc._id) === -1) {
            mpIdx[valueKey].push(doc._id);
          }
        }
        return true;
      } else {
        throw new Error(`CollectionIndex(...): ${typeof valueKey} type ` +
          'of index is not supported yet. It can be String, Number, Date.');
      }
    }
    return false;
  }

  remove(doc) {
    const valueKey = this.lookupFunction(doc)[0].value;
    this._checkRequiredFields(doc, valueKey);

    const mpIdx = this.mapIndex[valueKey];

    if (doc._id && valueKey) {
      if (this.unique) {
        delete this.mapIndex[valueKey];
      } else {
        const idx = mpIdx.indexOf(doc._id);
        if (idx !== -1) {
          mpIdx.splice(idx, 1);
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

    if (valueKeyOld && mpIdx[valueKeyOld]) {
      idxOld = mpIdx[valueKeyOld].indexOf(oldDoc._id);
    }

    if (valueKeyNew && mpIdx[valueKeyNew]) {
      idxNew = mpIdx[valueKeyNew].indexOf(newDoc._id);
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
    return this.mapIndex[value] || this.getAll();
  }

  getBetweenBounds(query) {
    // TODO
  }

  getAll(options) {
    var all = [];
    for (let key in this.mapIndex) {
      all = all.concat(this.mapIndex[key]);
    }
    return all;
  }

  _checkRequiredFields(doc, valKey) {
    invariant(
      doc._id,
      `CollectionIndex(...): document ${doc} must has field "_id", but hasn't`
    );
    invariant(
      valKey,
      `CollectionIndex(...): document ${doc} has no indexed "${this.keyName}" field`
    );
  }

}

export default MapIndex;
