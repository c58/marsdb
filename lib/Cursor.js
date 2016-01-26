import _bind from 'fast.js/function/bind';
import _each from 'fast.js/forEach';
import _filter from 'fast.js/array/filter';
import _reduce from 'fast.js/array/reduce';
import _assign from 'fast.js/object/assign';
import _keys from 'fast.js/object/keys';
import _map from 'fast.js/map';
import _check from 'check-types';
import AsyncEventEmitter from './AsyncEventEmitter';
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
    return Promise.all(_map(docs, (x, i) =>
      PIPELINE_PROCESSORS[PIPELINE_TYPE.JoinAll](x, pipeObj, cursor,
        i, docsLength)
    ));
  },
  [PIPELINE_TYPE.JoinAll]: (docs, pipeObj, cursor, i = 0, len = 1) => {
    const updatedFn = (cursor._propagateUpdate)
      ? _bind(cursor._propagateUpdate, cursor)
      : function() {};

    let res = pipeObj.value(docs, updatedFn, i, len);
    res = _check.array(res) ? res : [res];
    res =_map(res, val => {
      let cursorPromise;
      if (val instanceof Cursor) {
        cursorPromise = val.exec();
      } else if (_check.object(val) && val.cursor && val.then) {
        cursorPromise = val;
      }
      if (cursorPromise) {
        cursor._trackChildCursorPromise(cursorPromise);
      }
      return cursorPromise || val;
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
export class Cursor extends AsyncEventEmitter {
  constructor(db, query = {}, options = {}) {
    super();
    this.db = db;
    this.options = options;
    this._id = _currentCursorId++;
    this._query = query;
    this._pipeline = [];
    this._latestResult = null;
    this._childrenCursors = {};
    this._parentCursors = {};
    this._ensureMatcherSorter();
  }

  skip(skip) {
    invariant(
      skip >= 0 || typeof skip === 'undefined',
      'skip(...): skip must be a positive number'
    );

    this._skip = skip;
    return this;
  }

  limit(limit) {
    invariant(
      limit >= 0 || typeof limit === 'undefined',
      'limit(...): limit must be a positive number'
    );

    this._limit = limit;
    return this;
  }

  find(query) {
    this._query = query;
    this._ensureMatcherSorter();
    return this;
  }

  project(projection) {
    if (projection) {
      this._projector = new DocumentProjector(projection);
    } else {
      this._projector = null;
    }
    return this;
  }

  sort(sortObj) {
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

    this._addPipeline(PIPELINE_TYPE.Sort, sortFn);
    return this;
  }

  filter(filterFn) {
    invariant(
      typeof filterFn === 'function',
      'filter(...): argument must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.Filter, filterFn);
    return this;
  }

  map(mapperFn) {
    invariant(
      typeof mapperFn === 'function',
      'map(...): mapper must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.Map, mapperFn);
    return this;
  }

  reduce(reduceFn, initial) {
    invariant(
      typeof reduceFn === 'function',
      'reduce(...): reducer argument must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.Reduce, reduceFn, initial);
    return this;
  }

  aggregate(aggrFn) {
    invariant(
      typeof aggrFn === 'function',
      'aggregate(...): aggregator must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.Aggregate, aggrFn);
    return this;
  }

  join(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'join(...): argument must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.Join, joinFn);
    return this;
  }

  joinEach(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinEach(...): argument must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.JoinEach, joinFn);
    return this;
  }

  joinAll(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinAll(...): argument must be a function'
    );

    this._addPipeline(PIPELINE_TYPE.JoinAll, joinFn);
    return this;
  }

  ifNotEmpty() {
    this._addPipeline(PIPELINE_TYPE.IfNotEmpty);
    return this;
  }

  exec() {
    this.emit('beforeExecute');
    return this._createCursorPromise(
      this._doExecute().then((result) => {
        this._latestResult = result;
        return result;
      })
    );
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  _addPipeline(type, val, ...args) {
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

  _processPipeline(docs, i = 0) {
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
          return this._processPipeline(result, i + 1);
        }
      });
    }
  }

  _doExecute() {
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
        return this._processPipeline(clonned);
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

        const skip = this._skip || 0;
        const limit = this._limit || results.length;
        return results.slice(skip, limit + skip);
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

  _trackChildCursorPromise(childCursorPromise) {
    const childCursor = childCursorPromise.cursor;
    this._childrenCursors[childCursor._id] = childCursor;
    childCursor._parentCursors[this._id] = this;

    this.once('beforeExecute', () => {
      delete this._childrenCursors[childCursor._id];
      delete childCursor._parentCursors[this._id];
      if (_keys(childCursor._parentCursors).length === 0) {
        childCursor.emit('beforeExecute');
      }
    });
  }

  _createCursorPromise(promise, mixin = {}) {
    return _assign({
      cursor: this,
      then: (successFn, failFn) => {
        return this._createCursorPromise(
          promise.then(successFn, failFn),
          mixin
        );
      },
    }, mixin);
  }
}

export default Cursor;
