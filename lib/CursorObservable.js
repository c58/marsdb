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

  batchSize(batchSize) {
    this.update.updateBatchSize(batchSize);
    return this;
  }

  debounce(waitTime) {
    this.update.updateWait(waitTime);
    return this;
  }

  observe(listener) {
    // Listen for changes of the cursor
    this.on('update', listener);

    // Make new wrapper for make possible to observe
    // multiple times (for removeListener)
    const updateWrapper = (a, b) => this.maybeUpdate(a, b);
    this.db.on('insert', updateWrapper);
    this.db.on('update', updateWrapper);
    this.db.on('remove', updateWrapper);

    const firstUpdatePromise = this.update();
    const stopper = () => {
      this.removeListener('update', listener);
      this.db.removeListener('insert', updateWrapper);
      this.db.removeListener('update', updateWrapper);
      this.db.removeListener('remove', updateWrapper);
    };
    const createStoppablePromise = (currPromise) => {
      return {
        stop: stopper,
        then: function(successFn, failFn) {
          return createStoppablePromise(currPromise.then(successFn, failFn));
        },
      };
    };

    return createStoppablePromise(firstUpdatePromise);
  }

  update() {
    return this.exec().then((result) => {
      this._latestResult = result;
      this._latestIds = new Set(result.map(x => x._id));
      this.emit('update', result);
      return result;
    });
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
