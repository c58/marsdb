import _check from 'check-types';
import _map from 'fast.js/map';
import _filter from 'fast.js/array/filter';
import {selectorIsId, selectorIsIdPerhapsAsObject} from './Document';


// Internals
const DEFAULT_QUERY_FILTER = () => true;

/**
 * Class for getting data objects by given list of ids.
 * Promises based. It makes requests asyncronousle by
 * getting request frame from database.
 * It's not use caches, because it's a task of store.
 * It just retrives content by 'get' method.
 */
export class DocumentRetriver {
  constructor(db) {
    this.db = db;
  }

  /**
   * Retrive an optimal superset of documents
   * by given query based on _id field of the query
   *
   * TODO: there is a place for indexes
   *
   * @param  {Object} query
   * @return {Promise}
   */
  retriveForQeury(query, queryFilter = DEFAULT_QUERY_FILTER, options = {}) {
    // Try to get list of ids
    let selectorIds;
    if (selectorIsId(query)) {
      // fast path for scalar query
      selectorIds = [query];
    } else if (selectorIsIdPerhapsAsObject(query)) {
      // also do the fast path for { _id: idString }
      selectorIds = [query._id];
    } else if (
      _check.object(query) && query.hasOwnProperty('_id') &&
      _check.object(query._id) && query._id.hasOwnProperty('$in') &&
      _check.array(query._id.$in)
    ) {
      // and finally fast path for multiple ids
      // selected by $in operator
      selectorIds = query._id.$in;
    }

    // Retrive optimally
    if (_check.array(selectorIds) && selectorIds.length > 0) {
      return this.retriveIds(queryFilter, selectorIds, options);
    } else {
      return this.retriveAll(queryFilter, options);
    }
  }

  /**
   * Rterive all ids given in constructor.
   * If some id is not retrived (retrived qith error),
   * then returned promise will be rejected with that error.
   * @return {Promise}
   */
  retriveAll(queryFilter = DEFAULT_QUERY_FILTER, options = {}) {
    const limit = options.limit || +Infinity;
    const result = [];
    let stopped = false;

    return new Promise((resolve, reject) => {
      const stream = this.db.storage.createReadStream();

      stream.on('data', (data) => {
        // After deleting of an item some storages
        // may return an undefined for a few times.
        // We need to check it there.
        if (!stopped && data.value) {
          const doc = this.db.create(data.value);
          if (result.length < limit && queryFilter(doc)) {
            result.push(doc);
          }
          // Limit the result if storage supports it
          if (result.length === limit && stream.pause) {
            stream.pause();
            resolve(result);
            stopped = true;
          }
        }
      })
      .on('end', () => !stopped && resolve(result));
    });
  }

  /**
   * Rterive all ids given in constructor.
   * If some id is not retrived (retrived qith error),
   * then returned promise will be rejected with that error.
   * @return {Promise}
   */
  retriveIds(queryFilter = DEFAULT_QUERY_FILTER, ids = [], options = {}) {
    const uniqIds = _filter(ids, (id, i) => ids.indexOf(id) === i);
    const retrPromises = _map(uniqIds, id => this.retriveOne(id));
    const limit = options.limit || +Infinity;

    return Promise.all(retrPromises).then((res) => {
      const filteredRes = [];

      for (let i = 0; i < res.length; i++) {
        const doc = res[i];
        if (doc && queryFilter(doc)) {
          filteredRes.push(doc);
          if (filteredRes.length === limit) {
            break;
          }
        }
      }

      return filteredRes;
    });
  }

  /**
   * Retrive one document by given id
   * @param  {String} id
   * @return {Promise}
   */
  retriveOne(id) {
    return this.db.storage.get(id).then((buf) => this.db.create(buf));
  }
}

export default DocumentRetriver;
