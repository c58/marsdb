"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = debounce;
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
function debounce(func, wait, batchSize) {
  var timeout = null;
  var callsCount = 0;
  var promise = null;
  var doNotResolve = true;
  var _maybeResolve = null;

  var debouncer = function debouncer() {
    var context = this;
    var args = arguments;

    if (!promise) {
      promise = new Promise(function (resolve, reject) {
        _maybeResolve = function maybeResolve() {
          if (doNotResolve) {
            timeout = setTimeout(_maybeResolve, wait);
            doNotResolve = false;
          } else {
            resolve(func.apply(context, args));
            promise = null;
            callsCount = 0;
            timeout = null;
            doNotResolve = true;
            _maybeResolve = null;
          }
        };
        _maybeResolve();
      });
    } else {
      var callNow = batchSize && callsCount >= batchSize;
      doNotResolve = !callNow;

      if (callNow && _maybeResolve) {
        var returnPromise = promise;
        returnPromise.debouncePassed = true;
        clearTimeout(timeout);
        _maybeResolve();
        callsCount += 1;
        return returnPromise;
      }
    }

    callsCount += 1;
    return promise;
  };

  var updateBatchSize = function updateBatchSize(newBatchSize) {
    batchSize = newBatchSize;
  };
  var updateWait = function updateWait(newWait) {
    wait = newWait;
  };
  var cancel = function cancel() {
    clearTimeout(timeout);
  };

  debouncer.updateBatchSize = updateBatchSize;
  debouncer.updateWait = updateWait;
  debouncer.cancel = cancel;
  debouncer.func = func;
  return debouncer;
}