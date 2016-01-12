import _bind from 'fast.js/function/bind';
import _check from 'check-types';
import _map from 'fast.js/map';
import _keys from 'fast.js/object/keys';
import Cursor from './Cursor';
import EJSON from './EJSON';
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
    this.update = debounce(
      _bind(this.update, this),
      _defaultDebounce,
      _defaultBatchSize
    );
    this.maybeUpdate = _bind(this.maybeUpdate, this);
  }

  static defaultDebounce(waitTime) {
    _defaultDebounce = waitTime;
  }

  static defaultBatchSize(batchSize) {
    _defaultBatchSize = batchSize;
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
   * if `options.declare` is true, then initial update of
   * the cursor is not initiated and function will return
   * `this` instead promise. It means, that you can't stop
   * observer by a stopper object. Use `stopObservers()`
   * function instead.
   *
   * @param  {Function}
   * @param  {Object} options
   * @param  {Boolean} options.declare
   * @return {Stopper}
   */
  observe(listener, options = {}) {
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
      this.emit('stopped', listener);
    };

    listener = this._prepareListener(listener);
    this.on('update', listener);
    this.on('stop', stopper);

    const parentSetter = (cursor) => {
      this._parentCursor = cursor;
    };

    const cursorThenGenerator = (currPromise) => {
      return (successFn, failFn) => {
        successFn = this._prepareListener(successFn);
        return createStoppablePromise(currPromise.then(successFn, failFn));
      };
    };

    const createStoppablePromise = (currPromise) => {
      return {
        parent: parentSetter,
        stop: stopper,
        then: cursorThenGenerator(currPromise),
      };
    };

    if (options.declare) {
      return this;
    } else {
      const firstUpdatePromise = this.update.func(true);
      return createStoppablePromise(firstUpdatePromise);
    }
  }

  /**
   * Stop all observers of the cursor by one call
   * of this function.
   * It also stops any delaied update of the cursor.
   */
  stopObservers() {
    this.update.cancel();
    this.emit('stop');
  }

  /**
   * Update a cursor result. Debounced function,
   * return a Promise that resolved when cursor
   * is updated.
   * @return {Promise}
   */
  update(firstRun = false) {
    return this.exec({
      observable: true,
      firstRun: firstRun,
    }).then((result) => {
      this._latestResult = result;
      this._updateLatestIds();
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

    // When it's an update operation we check four things
    // 1. Is a new doc or old doc matched by a query?
    // 2. Is a new doc has different number of fields then an old doc?
    // 3. Is a new doc has a greater updatedAt time then an old doc?
    // 4. Is a new doc not equals to an old doc?
    const updatedInResult = removedFromResult || (newDoc && oldDoc && (
        this._matcher.documentMatches(newDoc).result ||
        this._matcher.documentMatches(oldDoc).result
      ) && (
        _keys(newDoc).length !== _keys(oldDoc).length || (
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
      this.emit('cursorChanged');
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

  /**
   * By a `_latestResult` update a `_latestIds` field of
   * the object
   */
  _updateLatestIds() {
    if (_check.array(this._latestResult)) {
      this._latestIds = new Set(_map(this._latestResult, x => x._id));
    } else if (this._latestResult && this._latestResult._id) {
      this._latestIds = new Set([this._latestResult._id]);
    }
  }
}

export default CursorObservable;
