'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Queue;
/**
 * @return {Object}
 */
/* istanbul ignore next */
var LocalPromise = typeof Promise !== 'undefined' ? Promise : function () {
  return {
    then: function then() {
      throw new Error('Queue.configure() before use Queue');
    }
  };
};

/* istanbul ignore next */
var noop = function noop() {};

/**
 * @param {*} value
 * @returns {LocalPromise}
 */
/* istanbul ignore next */
var resolveWith = function resolveWith(value) {
  if (value && typeof value.then === 'function') {
    return value;
  }

  return new LocalPromise(function (resolve) {
    resolve(value);
  });
};

/**
 * It limits concurrently executed promises
 *
 * @param {Number} [maxPendingPromises=Infinity] max number of concurrently executed promises
 * @param {Number} [maxQueuedPromises=Infinity]  max number of queued promises
 * @constructor
 *
 * @example
 *
 * var queue = new Queue(1);
 *
 * queue.add(function () {
 *     // resolve of this promise will resume next request
 *     return downloadTarballFromGithub(url, file);
 * })
 * .then(function (file) {
 *     doStuffWith(file);
 * });
 *
 * queue.add(function () {
 *     return downloadTarballFromGithub(url, file);
 * })
 * // This request will be paused
 * .then(function (file) {
 *     doStuffWith(file);
 * });
 */
/* istanbul ignore next */
function Queue(maxPendingPromises, maxQueuedPromises) {
  this.pendingPromises = 0;
  this.maxPendingPromises = typeof maxPendingPromises !== 'undefined' ? maxPendingPromises : Infinity;
  this.maxQueuedPromises = typeof maxQueuedPromises !== 'undefined' ? maxQueuedPromises : Infinity;
  this.queue = [];
}

/**
 * Defines promise promiseFactory
 * @param {Function} GlobalPromise
 */
/* istanbul ignore next */
Queue.configure = function (GlobalPromise) {
  LocalPromise = GlobalPromise;
};

/**
 * @param {Function} promiseGenerator
 * @return {LocalPromise}
 */
/* istanbul ignore next */
Queue.prototype.add = function (promiseGenerator) {
  var self = this;
  return new LocalPromise(function (resolve, reject, notify) {
    // Do not queue to much promises
    if (self.queue.length >= self.maxQueuedPromises) {
      reject(new Error('Queue limit reached'));
      return;
    }

    // Add to queue
    self.queue.push({
      promiseGenerator: promiseGenerator,
      resolve: resolve,
      reject: reject,
      notify: notify || noop
    });

    self._dequeue();
  });
};

/**
 * Number of simultaneously running promises (which are resolving)
 *
 * @return {number}
 */
/* istanbul ignore next */
Queue.prototype.getPendingLength = function () {
  return this.pendingPromises;
};

/**
 * Number of queued promises (which are waiting)
 *
 * @return {number}
 */
/* istanbul ignore next */
Queue.prototype.getQueueLength = function () {
  return this.queue.length;
};

/**
 * @returns {boolean} true if first item removed from queue
 * @private
 */
/* istanbul ignore next */
Queue.prototype._dequeue = function () {
  var self = this;
  if (this.pendingPromises >= this.maxPendingPromises) {
    return false;
  }

  // Remove from queue
  var item = this.queue.shift();
  if (!item) {
    return false;
  }

  try {
    this.pendingPromises++;

    resolveWith(item.promiseGenerator())
    // Forward all stuff
    .then(function (value) {
      // It is not pending now
      self.pendingPromises--;
      // It should pass values
      item.resolve(value);
      self._dequeue();
    }, function (err) {
      // It is not pending now
      self.pendingPromises--;
      // It should not mask errors
      item.reject(err);
      self._dequeue();
    }, function (message) {
      // It should pass notifications
      item.notify(message);
    });
  } catch (err) {
    self.pendingPromises--;
    item.reject(err);
    self._dequeue();
  }

  return true;
};