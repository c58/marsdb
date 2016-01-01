import _keys from 'lodash/object/keys';
import _each from 'lodash/collection/each';
import invariant from 'invariant';
import {QUERY_OPS} from './Document';
import flattenArray from 'flattenArray';
import isEmpty from 'isEmpty';
import Utils from './Utils';
import EJSON from './EJSON';


// Internal utils
// Exported for testing
export function _getIntersection(include, arrs) {
  const sets = arrs.filter(x => x).map(x => new Set(x));
  const result = new Set();

  if (!sets.length) {
    return [];
  }

  _each(sets[0], (v) => {
    let isResValue = true;
    for (let i = 1; i < sets.length; i++) {
      isResValue = sets[i].has(v);
      isResValue = include ? isResValue : !isResValue;
      if (!isResValue) {
        return false;
      }
    }
    if (isResValue) {
      result.add(v);
    }
  });

  return Array.from(result);
}

export function _getIncludeIntersection(arrs) {
  return _getIntersection(true, arrs);
}

export function _getExcludeIntersection(arrs) {
  return _getIntersection(false, arrs);
}

export function _getUnion(...arrs) {
  return Array.from(new Set(flattenArray(arrs)));
}

export function _makeMatchResult(options = {}, basic = {}) {
  if (options.include) {
    basic.include = basic.include || [];
    Array.prototype.push.apply(basic.include, options.include);
  }
  if (options.exclude) {
    basic.exclude = basic.exclude || [];
    Array.prototype.push.apply(basic.exclude, options.exclude);
  }
  return basic;
}

export function _normilizeQuery(query) {
  if (query === undefined || query === null) {
    return {_id: {$exists: false}};
  } else if (!Utils.isObject(query)) {
    return {_id: query};
  } else if (isEmpty(query)) {
    return {_id: {$exists: true}};
  }
  return query;
}


// Query parts implementation
const QUERY_LOGIC_OPS_IMPL = {
  [QUERY_OPS.$and]: function(retriver, key, value) {
    invariant(
      Utils.isArray(value),
      '$and(...): argument must be an array'
    );

    const matchPromises = value.map(q => retriver.execQuery(q));
    return Promise.all(matchPromises).then((matches) => {
      const result = _getIncludeIntersection(matches);
      return _makeMatchResult({include: result});
    });
  },

  [QUERY_OPS.$or]: function(retriver, key, value) {
    invariant(
      Utils.isArray(value),
      '$or(...): argument must be an array'
    );

    const matchPromises = value.map(q => retriver.execQuery(q));
    return Promise.all(matchPromises).then((matches) => {
      const result = _getUnion(matches);
      return _makeMatchResult({include: result});
    });
  },
};

const QUERY_COMP_OPS_IMPL = {
  [QUERY_OPS.$in]: function(index, value, basic, query) {
    invariant(
      Utils.isArray(value),
      '$in(...): argument must be an array'
    );
    _makeMatchResult({include: index.getMatching(value)}, basic);
  },

  [QUERY_OPS.$options]: function() {},
  [QUERY_OPS.$regex]: function(index, value, basic, query) {
    invariant(
      value instanceof RegExp || typeof value === 'string',
      '$regex(...): argument must be a RegExp or string'
    );

    const regex = Utils.ensureRegExp(value, query.$options);
    const matcher = (v) => v.key && regex.test(v.key);
    _makeMatchResult({include: index.getAll({matcher: matcher})}, basic);
  },

  [QUERY_OPS.$exists]: function(index, value, basic, query) {
    const withoutField = new Set();
    const withField = new Set();
    index.getAll({matcher: (v) => {
      if (v.key === undefined) {
        withoutField.add(v.value);
      } else {
        withField.add(v.value);
      }
    }});

    value = !!(value || value === '');
    const result = value
      ? {include: Array.from(withField)}
      : {include: _getExcludeIntersection([withoutField, withField])};

    _makeMatchResult(result, basic);
  },

  [QUERY_OPS.$lt]: function(index, value, basic, query) {
    _makeMatchResult({include: index.getBetweenBounds(query)}, basic);
    delete query.$lt;
    delete query.$lte;
    delete query.$gt;
    delete query.$get;
  },

  [QUERY_OPS.$lte]: function(...args) {
    QUERY_COMP_OPS_IMPL[QUERY_OPS.$lt](...args);
  },

  [QUERY_OPS.$gt]: function(...args) {
    QUERY_COMP_OPS_IMPL[QUERY_OPS.$lt](...args);
  },

  [QUERY_OPS.$gte]: function(...args) {
    QUERY_COMP_OPS_IMPL[QUERY_OPS.$lt](...args);
  },
};


/**
 * Class for getting list of IDs by
 * given query object. For now it uses only
 * indexes for making requests and build indexes
 * on the fly. With this condition it have
 * some restrictions in supported operators
 * of MongoDB-like queries.
 */
export class IndexMatcher {
  constructor(db, queryObj, sortObj = {}) {
    this.db = db;
    this.queryObj = queryObj;
    this.sortObj = sortObj;
    this._usedKeys = new Set();
  }

  /**
   * Matchs the query and resolve a list of Object IDs
   * @return {Promise}
   */
  match() {
    return this.execSortQuery().then((sortedIds) => {
      sortedIds = (isEmpty(sortedIds)) ? this.db.getIndexIds(): sortedIds;
      return this.execQuery(this.queryObj, sortedIds);
    }).then((queryRes) => {
      return queryRes;
    });
  }

  /**
   * Try to get sorted ids by sort object.
   * If no sort object provided returns empty array.
   * if more then one sort key provided rises an exception.
   * First of all it try to execute a key-value query to
   * get result for sorting. If query not exists it gets
   * all objects in a collection.
   *
   * @return {Promise}
   */
  execSortQuery() {
    const sortKeys = _keys(this.sortObj);

    if (sortKeys.length > 1) {
      throw new Error('Multiple sort keys are not supported yet');
    } else if (sortKeys.length === 0) {
      return Promise.resolve();
    } else {
      const sortKey = sortKeys[0];
      const keyQuery = this.queryObj[sortKey] || {};
      const sortDir = this.sortObj[sortKeys];
      const docIdsPromise = this.execLogicalQuery(sortKey, keyQuery);

      return docIdsPromise.then((matchedRes) => {
        const sortedRes = (sortDir === -1)
          ? matchedRes.include.reverse()
          : matchedRes.include;

        this._usedKeys.add(sortKey);
        return sortedRes;
      });
    }
  }

  /**
   * Execute given query and return a list of
   * ids. If result superset provided then result
   * can't be larger then this superset.
   *
   * @param  {Object} query
   * @param  {Object} resultSuperset
   * @return {Promise}
   */
  execQuery(query, resultSuperset) {
    query = _normilizeQuery(query);
    const queryKeys = _keys(query);
    const unusedKeys = queryKeys.filter(x => !this._usedKeys.has(x));
    const matchPromises = unusedKeys.map(
      k => this.execLogicalQuery(k, query[k])
    );

    return Promise.all(matchPromises).then((matches) => {
      // Get all included data
      const allIncludes = matches.filter(x => x.include).map(x => x.include);
      if (Array.isArray(resultSuperset)) {
        allIncludes.unshift(resultSuperset);
      }
      var result = _getIncludeIntersection(allIncludes);

      // Exclude from result data
      const allExcludes = matches.filter(x => x.exclude).map(x => x.exclude);
      allExcludes.unshift(result);
      return _getExcludeIntersection(allExcludes);
    });
  }

  /**
   * By given key execute a query. It process
   * special keys for logical operators ($and, $or, $not).
   * For executing regular key it uses indexes.
   * If index is not exists it invokes ensure
   * and then execute a query.
   *
   * @param  {String} key
   * @param  {Object} value
   * @return {Promise}
   */
  execLogicalQuery(key, query) {
    if (key[0] === '$') {
      invariant(
        QUERY_LOGIC_OPS_IMPL[key],
        'execLogicalQuery(...): logical operator %s is not supported',
        key
      );
      return QUERY_LOGIC_OPS_IMPL[key](this, key, query);
    }

    return this.db.ensureIndex({fieldName: key}).then(() => {
      return this.execCompareQuery(this.db.indexes[key], query);
    });
  }

  /**
   * Retrives ids from given index by given query.
   * Supported operations are:
   *   $in, $lt, $lte, $gt, $gte,
   *   $exists, $regex
   * Returns a list of ids.
   *
   * @param  {Object} index
   * @param  {Object} query
   * @return {Array}
   */
  execCompareQuery(index, query) {
    // Uncombinable
    if (query && query.$exists !== undefined && index.fieldName === '_id') {
      if (query.$exists) {
        return _makeMatchResult({include: index.getAll()});
      } else {
        return _makeMatchResult({exclude: index.getAll()});
      }
    }
    if (Utils.isPrimitiveType(query)) {
      return _makeMatchResult({include: index.getMatching(query)});
    }
    if (query instanceof RegExp) {
      query = {$regex: query};
    }

    // Clone for modify in processors
    query = EJSON.clone(query);

    // Combinable
    const basic = _makeMatchResult();
    const keys = _keys(query);
    const dollarFirstKeys = keys.filter(k => k && k[0] === '$');
    const pathKeys = keys.filter(k => k && k[0] !== '$');
    const isOnlyDollar = !pathKeys.length && dollarFirstKeys.length;
    const isMixed = pathKeys.length && dollarFirstKeys.length;

    invariant(
      !isMixed,
      'execCompareQuery(...): operators $... can\'t be mixed with normal fields'
    );

    if (isOnlyDollar && dollarFirstKeys.length) {
      _each(dollarFirstKeys, (key) => {
        invariant(
          QUERY_COMP_OPS_IMPL[key],
          'execCompareQuery(...): operation %s not supported',
          key
        );
        if (query[key] !== undefined) {
          QUERY_COMP_OPS_IMPL[key](index, query[key], basic, query);
        }
      });
    } else {
      _makeMatchResult({include: index.getMatching(query)}, basic);
    }

    return basic;
  }
}

export default IndexMatcher;
