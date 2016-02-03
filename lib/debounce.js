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
export default function debounce(func, wait, batchSize) {
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
            resolve(func.apply(context, args));
            promise = null;
            callsCount = 0;
            timeout = null;
            doNotResolve = true;
            maybeResolve = null;
          }
        };
        maybeResolve();
      });
    } else {
      const callNow = batchSize && callsCount >= batchSize;
      doNotResolve = !callNow;

      if (callNow && maybeResolve) {
        const returnPromise = promise;
        returnPromise.debouncePassed = true;
        clearTimeout(timeout);
        maybeResolve();
        callsCount += 1;
        return returnPromise;
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
  debouncer.func = func;
  return debouncer;
}
