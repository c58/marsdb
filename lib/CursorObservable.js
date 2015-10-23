import Cursor from './Cursor';


/**
 * Observable cursor is used for making request auto-updatable
 * after some changes is happen in a database.
 */
export class CursorObservable extends Cursor {
  constructor(db, query) {
    super(db, query);
    this.update = debounce(this.update.bind(this), 1000 / 15, 10);
    this.maybeUpdate = this.maybeUpdate.bind(this);
  }

  /**
   * Change a batch size of updater.
   * Btach size is a number of changes must be happen
   * in debounce interval to force execute debounced
   * function (update a result, in our case)
   *
   * @param  {Number} batchSize
   * @return {CursorObservable}
   */
  batchSize(batchSize) {
    this.update.updateBatchSize(batchSize);
    return this;
  }

  /**
   * Change debounce wait time of the updater
   * @param  {Number} waitTime
   * @return {CursorObservable}
   */
  debounce(waitTime) {
    this.update.updateWait(waitTime);
    return this;
  }

  /**
   * Observe changes of the cursor.
   * It returns a Stopper – Promise with `stop` function.
   * It is been resolved when first result of cursor is ready and
   * after first observe listener call.
   *
   * @param  {Function}
   * @return {Stopper}
   */
  observe(listener) {
    // Listen for changes of the cursor
    this._observing = true;
    this._haveListeners = this._haveListeners || !!listener;
    if (listener) {
      this.on('update', listener);
    }

    // Make new wrapper for make possible to observe
    // multiple times (for removeListener)
    const updateWrapper = (a, b) => this.maybeUpdate(a, b);
    this.db.on('insert', updateWrapper);
    this.db.on('update', updateWrapper);
    this.db.on('remove', updateWrapper);

    const firstUpdatePromise = this.update(true);
    const stopper = () => {
      this.db.removeListener('insert', updateWrapper);
      this.db.removeListener('update', updateWrapper);
      this.db.removeListener('remove', updateWrapper);
      if (listener) {
        this.removeListener('update', listener);
      }
    };
    const createStoppablePromise = (currPromise) => {
      // __onceUpdate is used when we do not need to know
      // a new result of a cursor, but just need to know
      // absout some changes happen. Used in observable joins.
      return {
        __haveListeners: this._haveListeners, // must be false
        __onceJustUpdated: this.once.bind(this, 'justUpdated'),
        stop: stopper,
        then: function(successFn, failFn) {
          return createStoppablePromise(currPromise.then(successFn, failFn));
        },
      };
    };

    return createStoppablePromise(firstUpdatePromise);
  }

  /**
   * Update a cursor result. Debounced function,
   * return a Promise that resolved when cursor
   * is updated.
   * @return {Promise}
   */
  update(firstRun = false) {
    if (!this._haveListeners && !firstRun) {
      // Fast path for just notifying about some changes
      // happen when no listeners to `observe` provided
      // and it's not a first run (initial data).
      // It's used in observable joins
      this.emit('justUpdated', null, firstRun);
      return Promise.resolve();
    } else {
      return this.exec().then((result) => {
        this._latestResult = result;
        this._latestIds = new Set(result.map(x => x._id));
        this.emit('update', result, firstRun);
        return result;
      });
    }
  }

  // TODO improve performance, we should be smarter
  //      and don't emit fully request update in many
  //      cases
  maybeUpdate(newDoc, oldDoc) {
    const removedFromResult = (
      !newDoc && oldDoc &&
      (!this._latestIds || this._latestIds.has(oldDoc._id))
    );

    const insertedInResult = removedFromResult || (
      newDoc && this._matcher.documentMatches(newDoc).result
    );

    if (insertedInResult) {
      return this.update();
    }
  }
}


/**
 * Debounce with updetable wait time and force
 * execution on some number of calls (batch execution)
 * Return promise that resolved with result of execution.
 * Promise cerated on each new execution (on idle).
 * @param  {Function} func
 * @param  {Number} wait
 * @param  {Number} batchSize
 * @return {Promise}
 */
export function debounce(func, wait, batchSize) {
  var timeout = null;
  var callsCount = 0;
  var promise = null;
  var doNotResolve = true;
  var maybeResolve = null;

  const debouncer = function() {
    const context = this;
    const args = arguments;

    if (!promise) {
      promise = new Promise((resolve, reject) => {
        maybeResolve = () => {
          if (doNotResolve) {
            timeout = setTimeout(maybeResolve, wait);
            doNotResolve = false;
          } else {
            promise = null;
            callsCount = 0;
            timeout = null;
            doNotResolve = true;
            maybeResolve = null;
            resolve(func.apply(context, args));
          }
        };
        maybeResolve();
      });
    } else {
      const callNow = batchSize && callsCount >= batchSize;
      doNotResolve = !callNow;

      if (callNow && maybeResolve) {
        clearTimeout(timeout);
        maybeResolve();
      }
    }

    callsCount += 1;
    return promise;
  };

  const updateBatchSize = function(newBatchSize) {
    batchSize = newBatchSize;
  };

  const updateWait = function(newWait) {
    wait = newWait;
  };

  const cancel = function() {
    clearTimeout(timeout);
  };

  debouncer.updateBatchSize = updateBatchSize;
  debouncer.updateWait = updateWait;
  debouncer.cancel = cancel;
  return debouncer;
}

export default CursorObservable;
