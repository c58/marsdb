import _bind from 'fast.js/function/bind';
import _each from 'fast.js/forEach';
import _filter from 'fast.js/array/filter';
import _reduce from 'fast.js/array/reduce';
import _map from 'fast.js/map';
import _check from 'check-types';
import EventEmitter from 'eventemitter3';
import invariant from 'invariant';
import DocumentRetriver from './DocumentRetriver';
import DocumentMatcher from './DocumentMatcher';
import DocumentSorter from './DocumentSorter';
import DocumentProjector from './DocumentProjector';
import EJSON from './EJSON';


// UUID counter for all cursors
let _currentCursorId = 0;

// Maker used for stopping pipeline processing
const PIPLEINE_STOP_MARKER = {};

// Pipeline processors definition
export const PIPELINE_TYPE = {
  Filter: 'Filter',
  Sort: 'Sort',
  Map: 'Map',
  Aggregate: 'Aggregate',
  Reduce: 'Reduce',
  Join: 'Join',
  JoinEach: 'JoinEach',
  JoinAll: 'JoinAll',
  IfNotEmpty: 'IfNotEmpty',
};

export const PIPELINE_PROCESSORS = {
  [PIPELINE_TYPE.Filter]: (docs, pipeObj) => {
    return _filter(docs, pipeObj.value);
  },
  [PIPELINE_TYPE.Sort]: (docs, pipeObj) => {
    return docs.sort(pipeObj.value);
  },
  [PIPELINE_TYPE.Map]: (docs, pipeObj) => {
    return _map(docs, pipeObj.value);
  },
  [PIPELINE_TYPE.Aggregate]:  (docs, pipeObj) => {
    return pipeObj.value(docs);
  },
  [PIPELINE_TYPE.Reduce]: (docs, pipeObj) => {
    return _reduce(docs, pipeObj.value, pipeObj.args[0]);
  },
  [PIPELINE_TYPE.Join]: (docs, pipeObj, cursor) => {
    if (_check.array(docs)) {
      return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinEach](docs, pipeObj, cursor);
    } else {
      return PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](docs, pipeObj, cursor);
    }
  },
  [PIPELINE_TYPE.JoinEach]: (docs, pipeObj, cursor) => {
    docs = _check.array(docs) ? docs : [docs];
    const docsLength = docs.length;
    return Promise.all(_map(docs, (x, i) => (
      PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](x, pipeObj, cursor,
        i, docsLength)
    )));
  },
  [PIPELINE_TYPE.JoinAll]: (docs, pipeObj, cursor, i = 0, len = 1) => {
    const updatedFn = (cursor._propagateUpdate)
      ? _bind(cursor._propagateUpdate, cursor)
      : function() {};

    let res = pipeObj.value(docs, updatedFn, i, len);
    res = _check.array(res) ? res : [res];

    _each(res, observeStopper => {
      if (_check.object(observeStopper) && observeStopper.then) {
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
    const isEmptyRes = (
      !_check.assigned(docs) ||
      (_check.array(docs) && _check.emptyArray(docs)) ||
      (_check.object(docs) && _check.emptyObject(docs))
    );
    return isEmptyRes ? PIPLEINE_STOP_MARKER : docs;
  },
};


/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */
export class Cursor extends EventEmitter {
  constructor(db, query = {}, options = {}) {
    super();
    this.db = db;
    this.options = options;
    this._id = _currentCursorId++;
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
    this._query = query;
    this._ensureMatcherSorter();
    return this;
  }

  project(projection) {
    this._ensureNotExecuting();
    if (projection) {
      this._projector = new DocumentProjector(projection);
    } else {
      this._projector = null;
    }
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
    invariant(
      typeof joinFn === 'function',
      'join(...): argument must be a function'
    );

    this.addPipeline(PIPELINE_TYPE.Join, joinFn);
    return this;
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
    if (!this._executing) {
      this._executing = this._doExec();
      this.whenNotExecuting().then(() => {
        this._executing = null;
      });
    } else if (!this._execPending) {
      this._execPending = true;
      this._executing = this.whenNotExecuting().then(() => {
        this._execPending = false;
        return this.exec();
      });
    }

    return this._executing;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  whenNotExecuting() {
    return Promise.resolve(this._executing).then(
      (value) => Promise.resolve().then(() => value),
      (err) => Promise.resolve().then(() => {
        throw err;
      })
    );
  }

  _doExec() {
    return this._matchObjects()
      .then(docs => {
        let clonned;
        if (this.options.noClone) {
          clonned = docs;
        } else {
          if (!this._projector) {
            clonned = _map(docs, doc => EJSON.clone(doc));
          } else {
            clonned = this._projector.project(docs);
          }
        }
        return this.processPipeline(clonned);
      });
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
