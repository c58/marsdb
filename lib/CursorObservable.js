import _bind from 'fast.js/function/bind';
import _check from 'check-types';
import _values from 'fast.js/object/values';
import _map from 'fast.js/map';
import Cursor from './Cursor';
import EJSON from './EJSON';
import PromiseQueue from './PromiseQueue';
import debounce from './debounce';


// Defaults
let _defaultDebounce = 1000 / 60;
let _defaultBatchSize = 10;

/**
 * Observable cursor is used for making request auto-updatable
 * after some changes is happen in a database.
 */
export class CursorObservable extends Cursor {
  constructor(db, query, options) {
    super(db, query, options);
    this.maybeUpdate = _bind(this.maybeUpdate, this);
    this._updateQueue = new PromiseQueue(1);
    this._propagateUpdate = debounce(_bind(this._propagateUpdate, this), 0, 0);
    this._doUpdate = debounce(
      _bind(this._doUpdate, this),
      _defaultDebounce,
      _defaultBatchSize
    );
    this._observers = 0;
  }

  static defaultDebounce() {
    if (arguments.length > 0) {
      _defaultDebounce = arguments[0];
    } else {
      return _defaultDebounce;
    }
  }

  static defaultBatchSize() {
    if (arguments.length > 0) {
      _defaultBatchSize = arguments[0];
    } else {
      return _defaultBatchSize;
    }
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
    this._doUpdate.updateBatchSize(batchSize);
    return this;
  }

  /**
   * Change debounce wait time of the updater
   * @param  {Number} waitTime
   * @return {CursorObservable}
   */
  debounce(waitTime) {
    this._doUpdate.updateWait(waitTime);
    return this;
  }

  /**
   * Observe changes of the cursor.
   * It returns a Stopper – Promise with `stop` function.
   * It is been resolved when first result of cursor is ready and
   * after first observe listener call.
   *
   * @param  {Function}
   * @param  {Object} options
   * @return {Stopper}
   */
  observe(listener, options = {}) {
    // Make new wrapper for make possible to observe
    // multiple times (for removeListener)
    const updateWrapper = (a, b) => this.maybeUpdate(a, b);
    listener = listener || function() {};

    this.db.on('insert', updateWrapper);
    this.db.on('update', updateWrapper);
    this.db.on('remove', updateWrapper);

    let running = true;
    const self = this;
    function stopper() {
      if (running) {
        self.db.removeListener('insert', updateWrapper);
        self.db.removeListener('update', updateWrapper);
        self.db.removeListener('remove', updateWrapper);
        self.removeListener('update', listener);
        self.removeListener('stop', stopper);

        running = false;
        self._observers -= 1;
        if (self._observers === 0) {
          self._latestIds = null;
          self._latestResult = null;
          self.emit('observeStopped');
        }
      }
    }

    this._observers += 1;
    this.on('update', listener);
    this.on('stop', stopper);

    if (!this._updatePromise) {
      this.update(true, true);
    } else if (this._latestResult !== null) {
      listener(this._latestResult);
    }

    const cursorPromiseMixin = { stop: stopper };
    return this._createCursorPromise(
      this._updatePromise, cursorPromiseMixin
    );
  }

  /**
   * Stop all observers of the cursor by one call
   * of this function.
   * It also stops any delaied update of the cursor.
   */
  stopObservers() {
    this._doUpdate.cancel();
    this.emit('stop');
    return this;
  }

  /**
   * Executes an update. It is guarantee that
   * one `_doUpdate` will be executed at one time.
   *
   * TODO it's a bit hacky implementation, but it works well.
   * 			I can't imagine more clearly impl for now.
   * @return {Promise}
   */
  update(firstRun = false, immidiatelly = false) {
    this._updatePromise = this._updateQueue.add(() => {
      this._updatePromise = immidiatelly
        ? this._doUpdate.func(firstRun)
        : this._doUpdate(firstRun);

      if (immidiatelly) {
        return this._updatePromise;
      } else {
        if (this._updatePromise.debouncePassed) {
          return this._updatePromise;
        } else {
          return Promise.resolve('__debounced__');
        }
      }
    })
    .then(res =>
      res === '__debounced__'
        ? this._updatePromise
        : res
    );

    return this._updatePromise;
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
    // When no newDoc and no oldDoc provided then
    // it's a special case when no data about update
    // available and we always need to update a cursor
    const alwaysUpdateCursor = newDoc === null && oldDoc === null;

    // When it's remove operation we just check
    // that it's in our latest result ids list
    const removedFromResult = alwaysUpdateCursor || (
      !newDoc && oldDoc &&
      (!this._latestIds || this._latestIds.has(oldDoc._id))
    );

    // When it's an update operation we check four things
    // 1. Is a new doc or old doc matched by a query?
    // 2. Is a new doc has different number of fields then an old doc?
    // 3. Is a new doc not equals to an old doc?
    const updatedInResult = removedFromResult || (newDoc && oldDoc && (
        this._matcher.documentMatches(newDoc).result ||
        this._matcher.documentMatches(oldDoc).result
      ) && !EJSON.equals(newDoc, oldDoc)
    );

    // When it's an insert operation we just check
    // it's match a query
    const insertedInResult = updatedInResult || (newDoc && !oldDoc && (
      this._matcher.documentMatches(newDoc).result
    ));

    if (insertedInResult) {
      this.emit('cursorChanged');
      return this.update();
    }
  }

  /**
   * DEBOUNCED
   * Emits an update event with current result of a cursor
   * and call this method on parent cursor if it exists
   * and if it is not first run of update.
   * @return {Promise}
   */
  _propagateUpdate(firstRun = false) {
    const updatePromise = this.emitAsync(
      'update', this._latestResult, firstRun
    );

    let parentUpdatePromise;
    if (!firstRun) {
      parentUpdatePromise = Promise.all(
        _values(_map(this._parentCursors, (v, k) => {
          if (v._propagateUpdate) {
            return v._propagateUpdate(false);
          }
        }))
      );
    }

    return updatePromise.then(() => parentUpdatePromise);
  }

  /**
   * DEBOUNCED
   * Execute query and propagate result to observers.
   * Resolved with result of execution.
   * @param  {Boolean} firstRun
   * @return {Promise}
   */
  _doUpdate(firstRun = false) {
    return this.exec().then((result) => {
      this._updateLatestIds();
      return this._propagateUpdate(firstRun)
        .then(() => result);
    });
  }

  /**
   * By a `_latestResult` update a `_latestIds` field of
   * the object
   */
  _updateLatestIds() {
    const idsArr = _check.array(this._latestResult)
      ? _map(this._latestResult, x => x._id)
      : this._latestResult && [this._latestResult._id];
    this._latestIds = new Set(idsArr);
  }

  /**
   * Track child cursor and stop child observer
   * if this cusros stopped or changed.
   * @param  {CursorPromise} cursorPromise
   */
  _trackChildCursorPromise(cursorPromise) {
    super._trackChildCursorPromise(cursorPromise);
    if (cursorPromise.stop) {
      this.once('cursorChanged', cursorPromise.stop);
      this.once('observeStopped', cursorPromise.stop);
      this.once('beforeExecute', cursorPromise.stop);
    }
  }
}

export default CursorObservable;
