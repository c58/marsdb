'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

exports.debounce = debounce;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _Cursor2 = require('./Cursor');

var _Cursor3 = _interopRequireDefault(_Cursor2);

/**
 * Observable cursor is used for making request auto-updatable
 * after some changes is happen in a database.
 */

var CursorObservable = (function (_Cursor) {
  _inherits(CursorObservable, _Cursor);

  function CursorObservable(db, query) {
    _classCallCheck(this, CursorObservable);

    _get(Object.getPrototypeOf(CursorObservable.prototype), 'constructor', this).call(this, db, query);
    this.update = debounce(this.update.bind(this), 1000 / 15, 10);
    this.maybeUpdate = this.maybeUpdate.bind(this);
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

  _createClass(CursorObservable, [{
    key: 'batchSize',
    value: function batchSize(_batchSize) {
      this.update.updateBatchSize(_batchSize);
      return this;
    }
  }, {
    key: 'debounce',
    value: function debounce(waitTime) {
      this.update.updateWait(waitTime);
      return this;
    }
  }, {
    key: 'observe',
    value: function observe(listener) {
      var _this = this;

      // Listen for changes of the cursor
      this.on('update', listener);

      // Make new wrapper for make possible to observe
      // multiple times (for removeListener)
      var updateWrapper = function (a, b) {
        return _this.maybeUpdate(a, b);
      };
      this.db.on('insert', updateWrapper);
      this.db.on('update', updateWrapper);
      this.db.on('remove', updateWrapper);

      var firstUpdatePromise = this.update();
      var stopper = function () {
        _this.removeListener('update', listener);
        _this.db.removeListener('insert', updateWrapper);
        _this.db.removeListener('update', updateWrapper);
        _this.db.removeListener('remove', updateWrapper);
      };
      var createStoppablePromise = function (currPromise) {
        return {
          stop: stopper,
          then: function (successFn, failFn) {
            return createStoppablePromise(currPromise.then(successFn, failFn));
          }
        };
      };

      return createStoppablePromise(firstUpdatePromise);
    }
  }, {
    key: 'update',
    value: function update() {
      var _this2 = this;

      return this.exec().then(function (result) {
        _this2._latestResult = result;
        _this2._latestIds = new Set(result.map(function (x) {
          return x._id;
        }));
        _this2.emit('update', result);
        return result;
      });
    }

    // TODO improve performance, we should be smarter
    //      and don't emit fully request update in many
    //      cases
  }, {
    key: 'maybeUpdate',
    value: function maybeUpdate(newDoc, oldDoc) {
      var removedFromResult = !newDoc && oldDoc && (!this._latestIds || this._latestIds.has(oldDoc._id));

      var insertedInResult = removedFromResult || newDoc && this._matcher.documentMatches(newDoc).result;

      if (insertedInResult) {
        return this.update();
      }
    }
  }]);

  return CursorObservable;
})(_Cursor3['default']);

exports.CursorObservable = CursorObservable;

function debounce(func, wait, batchSize) {
  var timeout = null;
  var callsCount = 0;
  var promise = null;
  var doNotResolve = true;
  var maybeResolve = null;

  var debouncer = function () {
    var context = this;
    var args = arguments;

    if (!promise) {
      promise = new Promise(function (resolve, reject) {
        maybeResolve = function () {
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
      var callNow = batchSize && callsCount >= batchSize;
      doNotResolve = !callNow;

      if (callNow && maybeResolve) {
        clearTimeout(timeout);
        maybeResolve();
      }
    }

    callsCount += 1;
    return promise;
  };

  var updateBatchSize = function (newBatchSize) {
    batchSize = newBatchSize;
  };

  var updateWait = function (newWait) {
    wait = newWait;
  };

  var cancel = function () {
    clearTimeout(timeout);
  };

  debouncer.updateBatchSize = updateBatchSize;
  debouncer.updateWait = updateWait;
  debouncer.cancel = cancel;
  return debouncer;
}

exports['default'] = CursorObservable;