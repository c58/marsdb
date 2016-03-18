import _each from 'fast.js/forEach';
import _assign from 'fast.js/object/assign';
import _keys from 'fast.js/object/keys';
import _map from 'fast.js/map';
import AsyncEventEmitter from './AsyncEventEmitter';
import invariant from 'invariant';
import DocumentRetriver from './DocumentRetriver';
import DocumentMatcher from './DocumentMatcher';
import DocumentSorter from './DocumentSorter';
import DocumentProjector from './DocumentProjector';
import EJSON from './EJSON';


// UUID counter for all cursors
let _currentCursorId = 0;

// Pipeline processors map
export const PIPELINE_PROCESSORS = {
  ...require('./cursor-processors/filter'),
  ...require('./cursor-processors/sortFunc'),
  ...require('./cursor-processors/map'),
  ...require('./cursor-processors/aggregate'),
  ...require('./cursor-processors/reduce'),
  ...require('./cursor-processors/join'),
  ...require('./cursor-processors/joinEach'),
  ...require('./cursor-processors/joinAll'),
  ...require('./cursor-processors/joinObj'),
  ...require('./cursor-processors/ifNotEmpty'),
};

// Create basic cursor with pipeline methods
class BasicCursor extends AsyncEventEmitter {}
_each(PIPELINE_PROCESSORS, (v, procName) => {
  BasicCursor.prototype[procName] = v.method;
});


/**
 * Class for storing information about query
 * and executing it. It also have a sugar like
 * map/reduce, aggregation and others for making
 * fully customizable response
 */
export class Cursor extends BasicCursor {
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
      type && PIPELINE_PROCESSORS[type],
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
        PIPELINE_PROCESSORS[pipeObj.type].process(
          docs, pipeObj, this
        )
      ).then((result) => {
        if (result === '___[STOP]___') {
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
    const withFastLimit = this._limit && !this._skip && !this._sorter;
    const retrOpts = withFastLimit ? { limit: this._limit } : {};
    const queryFilter = (doc) => {
      return doc && this._matcher.documentMatches(doc).result;
    };

    return new DocumentRetriver(this.db)
      .retriveForQeury(this._query, queryFilter, retrOpts)
      .then((results) => {
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
