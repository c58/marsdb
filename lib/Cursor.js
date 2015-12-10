import _each from 'lodash/collection/each';
import _isObject from 'lodash/lang/isObject';
import _isArray from 'lodash/lang/isArray';
import _isEmpty from 'lodash/lang/isEmpty';
import _keys from 'lodash/object/keys';
import EventEmitter from 'eventemitter3';
import invariant from 'invariant';
import keyMirror from 'keymirror';
import DocumentRetriver from './DocumentRetriver';
import DocumentMatcher from './DocumentMatcher';
import DocumentSorter from './DocumentSorter';


// Maker used for stopping pipeline processing
const PIPLEINE_STOP_MARKER = {};

// Pipeline processors definition
export const PIPELINE_TYPE = keyMirror({
  Filter: null,
  Sort: null,
  Map: null,
  Aggregate: null,
  Reduce: null,
  Join: null,
  JoinEach: null,
  JoinAll: null,
  IfNotEmpty: null,
});

export const PIPELINE_PROCESSORS = {
  [PIPELINE_TYPE.Filter]: (docs, pipeObj) => {
    return docs.filter(pipeObj.value);
  },
  [PIPELINE_TYPE.Sort]: (docs, pipeObj) => {
    return docs.sort(pipeObj.value);
  },
  [PIPELINE_TYPE.Map]: (docs, pipeObj) => {
    return docs.map(pipeObj.value);
  },
  [PIPELINE_TYPE.Aggregate]:  (docs, pipeObj) => {
    return pipeObj.value(docs);
  },
  [PIPELINE_TYPE.Reduce]: (docs, pipeObj) => {
    return docs.reduce(pipeObj.value, pipeObj.args[0]);
  },
  [PIPELINE_TYPE.Join]: (docs, pipeObj, cursor) => {
    return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinEach](docs, pipeObj, cursor);
  },
  [PIPELINE_TYPE.JoinEach]: (docs, pipeObj, cursor) => {
    return Promise.all((_isArray(docs) ? docs : [docs]).map((x) => (
      PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](x, pipeObj, cursor)
    )));
  },
  [PIPELINE_TYPE.JoinAll]: (docs, pipeObj, cursor) => {
    let res = pipeObj.value(docs);
    res = _isArray(res) ? res : [res];
    res.forEach(observeStopper => {
      if (_isObject(observeStopper) && observeStopper.then) {
        if (observeStopper.parent) {
          observeStopper.parent(cursor);
          cursor.once('stopped', observeStopper.stop);
          cursor.once('cursorChanged', observeStopper.stop);
        }
      }
    });
    return Promise.all(res).then(() => docs);
  },
  [PIPELINE_TYPE.IfNotEmpty]: (docs) => {
    return _isEmpty(docs) ? PIPLEINE_STOP_MARKER : docs;
  },
};


/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */
export class Cursor extends EventEmitter {
  constructor(db, query) {
    super();
    this.db = db;
    this._query = query;
    this._pipeline = [];
    this._executing = null;
    this._ensureMatcherSorter();
  }

  get isExecuting() {
    return !!this._executing;
  }

  skip(skip) {
    this._ensureNotExecuting();
    invariant(
      skip >= 0 || typeof skip === 'undefined',
      'skip(...): skip must be a positive number'
    );

    this._skip = skip;
    return this;
  }

  limit(limit) {
    this._ensureNotExecuting();
    invariant(
      limit >= 0 || typeof limit === 'undefined',
      'limit(...): limit must be a positive number'
    );

    this._limit = limit;
    return this;
  }

  find(query) {
    this._ensureNotExecuting();
    this._query = query || this._query;
    this._ensureMatcherSorter();
    return this;
  }

  sort(sortObj) {
    this._ensureNotExecuting();
    invariant(
      typeof sortObj === 'object' || typeof sortObj === 'undefined' || Array.isArray(sortObj),
      'sort(...): argument must be an object'
    );

    this._sort = sortObj;
    this._ensureMatcherSorter();
    return this;
  }

  sortFunc(sortFn) {
    invariant(
      typeof sortFn === 'function',
      'sortFunc(...): argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Sort, sortFn);
    return this;
  }

  filter(filterFn) {
    invariant(
      typeof filterFn === 'function',
      'filter(...): argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Filter, filterFn);
    return this;
  }

  map(mapperFn) {
    invariant(
      typeof mapperFn === 'function',
      'map(...): mapper must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Map, mapperFn);
    return this;
  }

  reduce(reduceFn, initial) {
    invariant(
      typeof reduceFn === 'function',
      'reduce(...): reducer argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Reduce, reduceFn, initial);
    return this;
  }

  aggregate(aggrFn) {
    invariant(
      typeof aggrFn === 'function',
      'aggregate(...): aggregator must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Aggregate, aggrFn);
    return this;
  }

  join(joinFn) {
    return this.joinEach(joinFn);
  }

  joinEach(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinEach(...): argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.JoinEach, joinFn);
    return this;
  }

  joinAll(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinAll(...): argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.JoinAll, joinFn);
    return this;
  }

  ifNotEmpty() {
    this.addPipeline(PIPELINE_TYPE.IfNotEmpty);
    return this;
  }

  addPipeline(type, val, ...args) {
    this._ensureNotExecuting();
    invariant(
      type && PIPELINE_TYPE[type],
      'Unknown pipeline processor type %s',
      type
    );

    this._pipeline.push({
      type: type,
      value: val,
      args: args || [],
    });
    return this;
  }

  processPipeline(docs, i = 0) {
    const pipeObj = this._pipeline[i];
    if (!pipeObj) {
      return Promise.resolve(docs);
    } else {
      return Promise.resolve(
        PIPELINE_PROCESSORS[pipeObj.type](docs, pipeObj, this)
      ).then((result) => {
        if (result === PIPLEINE_STOP_MARKER) {
          return result;
        } else {
          return this.processPipeline(result, i + 1);
        }
      });
    }
  }

  processSkipLimits(docs) {
    const skip = this._skip || 0;
    const limit = this._limit || docs.length;
    return docs.slice(skip, limit + skip);
  }

  exec() {
    this._executing = this._matchObjects().then((docs) => {
      return this.processPipeline(docs);
    }).then((docs) => {
      this._executing = null;
      return docs;
    });

    return this._executing;
  }

  ids() {
    this._executing = this._matchObjects().then((docs) => {
      return docs.map(x => x._id);
    }).then((ids) => {
      this._executing = null;
      return ids;
    });

    return this._executing;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  whenNotExecuting() {
    return Promise.resolve(this._executing);
  }

  _matchObjects() {
    return new DocumentRetriver(this.db)
      .retriveForQeury(this._query)
      .then((docs) => {
        const results = [];
        const withFastLimit = this._limit && !this._skip && !this._sorter;

        _each(docs, (d) => {
          const match = this._matcher.documentMatches(d);
          if (match.result) {
            results.push(d);
          }
          if (withFastLimit && results.length === this._limit) {
            return false;
          }
        });

        if (withFastLimit) {
          return results;
        }

        if (this._sorter) {
          const comparator = this._sorter.getComparator();
          results.sort(comparator);
        }

        return this.processSkipLimits(results);
      }
    );
  }

  _ensureMatcherSorter() {
    this._sorter = undefined;
    this._matcher = new DocumentMatcher(this._query || {});

    if (this._matcher.hasGeoQuery || this._sort) {
      this._sorter = new DocumentSorter(
        this._sort || [], { matcher: this._matcher });
    }
  }

  _ensureNotExecuting() {
    invariant(
      !this.isExecuting,
      '_ensureNotExecuting(...): cursor is executing, cursor is immutable!'
    );
  }
}

export default Cursor;
