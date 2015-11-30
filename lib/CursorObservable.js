import _size from 'lodash/collection/size';
import Cursor from './Cursor';
import EJSON from './EJSON';


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
    listener = this._prepareListener(listener);
    this.on('update', listener);

    // Make new wrapper for make possible to observe
    // multiple times (for removeListener)
    const updateWrapper = (a, b) => this.maybeUpdate(a, b);
    this.db.on('insert', updateWrapper);
    this.db.on('update', updateWrapper);
    this.db.on('remove', updateWrapper);

    const stopper = () => {
      this.db.removeListener('insert', updateWrapper);
      this.db.removeListener('update', updateWrapper);
      this.db.removeListener('remove', updateWrapper);
      this.removeListener('update', listener);
      this.emit('stopped');
    };

    const parentSetter = (cursor) => {
      this._parentCursor = cursor;
    };

    const createStoppablePromise = (currPromise) => {
      return {
        parent: parentSetter,
        stop: stopper,
        then: (successFn, failFn) => {
          successFn = this._prepareListener(successFn);
          return createStoppablePromise(currPromise.then(successFn, failFn));
        },
      };
    };

    const firstUpdatePromise = this.update(true);
    return createStoppablePromise(firstUpdatePromise);
  }

  /**
   * Update a cursor result. Debounced function,
   * return a Promise that resolved when cursor
   * is updated.
   * @return {Promise}
   */
  update(firstRun = false) {
    return this.exec().then((result) => {
      this._latestResult = result;
      this._latestIds = new Set(result.map(x => x._id));
      this._propagateUpdate(firstRun);
      return result;
    });
  }

  /**
   * Consider to update a query by given newDoc and oldDoc,
   * received form insert/udpate/remove oparation.
   * Should make a decision as smart as possible.
   * (Don't update a cursor if it does not change a result
   * of a cursor)
   *
   * TODO we should update _latestResult by hands in some cases
   *      without a calling of `update` method
   *
   * @param  {Object} newDoc
   * @param  {Object} oldDoc
   */
  maybeUpdate(newDoc, oldDoc) {
    // When it's remove operation we just check
    // that it's in our latest result ids list
    const removedFromResult = (
      !newDoc && oldDoc &&
      (!this._latestIds || this._latestIds.has(oldDoc._id))
    );

    // When it's an update operation we check three things
    // 1. Is a new doc or old doc matched by a query?
    // 2. Is a new doc has different number of fields then an old doc?
    // 3. Is a new doc has a greater updatedAt time then an old doc?
    // 4. Is a new doc not equals to an old doc?
    const updatedInResult = removedFromResult || (newDoc && oldDoc && (
        this._matcher.documentMatches(newDoc).result ||
        this._matcher.documentMatches(oldDoc).result
      ) && (
        _size(newDoc) !== _size(oldDoc) || (
          newDoc.updatedAt && (
            !oldDoc.updatedAt ||
            (oldDoc.updatedAt && newDoc.updatedAt > oldDoc.updatedAt)
          )
        ) || (
          !EJSON.equals(newDoc, oldDoc)
        )
      )
    );

    // When it's an insert operation we just check
    // it's match a query
    const insertedInResult = updatedInResult || (newDoc && !oldDoc && (
      this._matcher.documentMatches(newDoc).result
    ));

    if (insertedInResult) {
      return this.update();
    }
  }

  /**
   * Preapare a listener of updates. By default it just debounce
   * it a little for no useless updates when update propagated
   * from children cursors.
   * It also applied to successFn of `then` of returned by
   * `observer` stoper object.
   * @param  {Function} listener
   * @return {Promise}
   */
  _prepareListener(listener) {
    // Debounce listener a little for update propagation
    // when joins updated
    return debounce(listener, 0, 0);
  }

  /**
   * Emits an update event with current result of a cursor
   * and call this method on parent cursor if it exists
   * and if it is not first run of update.
   */
  _propagateUpdate(firstRun = false) {
    this.emit('update', this._latestResult, firstRun);
    if (!firstRun && this._parentCursor && this._parentCursor._propagateUpdate) {
      this._parentCursor._propagateUpdate(false);
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
