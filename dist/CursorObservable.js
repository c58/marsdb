'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CursorObservable = undefined;

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _Cursor2 = require('./Cursor');

var _Cursor3 = _interopRequireDefault(_Cursor2);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

var _debounce = require('./debounce');

var _debounce2 = _interopRequireDefault(_debounce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// Defaults
var _defaultDebounce = 1000 / 60;
var _defaultBatchSize = 10;

/**
 * Observable cursor is used for making request auto-updatable
 * after some changes is happen in a database.
 */

var CursorObservable = (function (_Cursor) {
  _inherits(CursorObservable, _Cursor);

  function CursorObservable(db, query, options) {
    _classCallCheck(this, CursorObservable);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(CursorObservable).call(this, db, query, options));

    _this.update = (0, _debounce2.default)((0, _bind3.default)(_this.update, _this), _defaultDebounce, _defaultBatchSize);
    _this.maybeUpdate = (0, _bind3.default)(_this.maybeUpdate, _this);
    return _this;
  }

  _createClass(CursorObservable, [{
    key: 'batchSize',

    /**
     * Change a batch size of updater.
     * Btach size is a number of changes must be happen
     * in debounce interval to force execute debounced
     * function (update a result, in our case)
     *
     * @param  {Number} batchSize
     * @return {CursorObservable}
     */
    value: function batchSize(_batchSize) {
      this.update.updateBatchSize(_batchSize);
      return this;
    }

    /**
     * Change debounce wait time of the updater
     * @param  {Number} waitTime
     * @return {CursorObservable}
     */

  }, {
    key: 'debounce',
    value: function debounce(waitTime) {
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

  }, {
    key: 'observe',
    value: function observe(listener) {
      var _this2 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      // Make new wrapper for make possible to observe
      // multiple times (for removeListener)
      var updateWrapper = function updateWrapper(a, b) {
        return _this2.maybeUpdate(a, b);
      };
      this.db.on('insert', updateWrapper);
      this.db.on('update', updateWrapper);
      this.db.on('remove', updateWrapper);

      var stopper = function stopper() {
        _this2.db.removeListener('insert', updateWrapper);
        _this2.db.removeListener('update', updateWrapper);
        _this2.db.removeListener('remove', updateWrapper);
        _this2.removeListener('update', listener);
        _this2.emit('stopped', listener);
      };

      listener = this._prepareListener(listener);
      this.on('update', listener);
      this.on('stop', stopper);

      var parentSetter = function parentSetter(cursor) {
        _this2._parentCursor = cursor;
      };

      var cursorThenGenerator = function cursorThenGenerator(currPromise) {
        return function (successFn, failFn) {
          successFn = _this2._prepareListener(successFn);
          return createStoppablePromise(currPromise.then(successFn, failFn));
        };
      };

      var createStoppablePromise = function createStoppablePromise(currPromise) {
        return {
          parent: parentSetter,
          stop: stopper,
          then: cursorThenGenerator(currPromise)
        };
      };

      if (options.declare) {
        return this;
      } else {
        var firstUpdatePromise = this.update.func(true);
        return createStoppablePromise(firstUpdatePromise);
      }
    }

    /**
     * Stop all observers of the cursor by one call
     * of this function.
     * It also stops any delaied update of the cursor.
     */

  }, {
    key: 'stopObservers',
    value: function stopObservers() {
      this.update.cancel();
      this.emit('stop');
    }

    /**
     * Update a cursor result. Debounced function,
     * return a Promise that resolved when cursor
     * is updated.
     * @return {Promise}
     */

  }, {
    key: 'update',
    value: function update() {
      var _this3 = this;

      var firstRun = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      return this.exec({
        observable: true,
        firstRun: firstRun
      }).then(function (result) {
        _this3._latestResult = result;
        _this3._updateLatestIds();
        _this3._propagateUpdate(firstRun);
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

  }, {
    key: 'maybeUpdate',
    value: function maybeUpdate(newDoc, oldDoc) {
      // When it's remove operation we just check
      // that it's in our latest result ids list
      var removedFromResult = !newDoc && oldDoc && (!this._latestIds || this._latestIds.has(oldDoc._id));

      // When it's an update operation we check four things
      // 1. Is a new doc or old doc matched by a query?
      // 2. Is a new doc has different number of fields then an old doc?
      // 3. Is a new doc has a greater updatedAt time then an old doc?
      // 4. Is a new doc not equals to an old doc?
      var updatedInResult = removedFromResult || newDoc && oldDoc && (this._matcher.documentMatches(newDoc).result || this._matcher.documentMatches(oldDoc).result) && ((0, _keys3.default)(newDoc).length !== (0, _keys3.default)(oldDoc).length || newDoc.updatedAt && (!oldDoc.updatedAt || oldDoc.updatedAt && newDoc.updatedAt > oldDoc.updatedAt) || !_EJSON2.default.equals(newDoc, oldDoc));

      // When it's an insert operation we just check
      // it's match a query
      var insertedInResult = updatedInResult || newDoc && !oldDoc && this._matcher.documentMatches(newDoc).result;

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

  }, {
    key: '_prepareListener',
    value: function _prepareListener(listener) {
      // Debounce listener a little for update propagation
      // when joins updated
      return (0, _debounce2.default)(listener, 0, 0);
    }

    /**
     * Emits an update event with current result of a cursor
     * and call this method on parent cursor if it exists
     * and if it is not first run of update.
     */

  }, {
    key: '_propagateUpdate',
    value: function _propagateUpdate() {
      var firstRun = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      this.emit('update', this._latestResult, firstRun);
      if (!firstRun && this._parentCursor && this._parentCursor._propagateUpdate) {
        this._parentCursor._propagateUpdate(false);
      }
    }

    /**
     * By a `_latestResult` update a `_latestIds` field of
     * the object
     */

  }, {
    key: '_updateLatestIds',
    value: function _updateLatestIds() {
      if (_checkTypes2.default.array(this._latestResult)) {
        this._latestIds = new Set((0, _map3.default)(this._latestResult, function (x) {
          return x._id;
        }));
      } else if (this._latestResult && this._latestResult._id) {
        this._latestIds = new Set([this._latestResult._id]);
      }
    }
  }], [{
    key: 'defaultDebounce',
    value: function defaultDebounce(waitTime) {
      _defaultDebounce = waitTime;
    }
  }, {
    key: 'defaultBatchSize',
    value: function defaultBatchSize(batchSize) {
      _defaultBatchSize = batchSize;
    }
  }]);

  return CursorObservable;
})(_Cursor3.default);

exports.CursorObservable = CursorObservable;
exports.default = CursorObservable;