import _try from 'fast.js/function/try';
import Deque from 'double-ended-queue';


/**
 * It limits concurrently executed promises
 *
 * @param {Number} [maxPendingPromises=Infinity] max number of concurrently executed promises
 * @param {Number} [maxQueuedPromises=Infinity]  max number of queued promises
 * @constructor
 */
export default class PromiseQueue {
  constructor(maxPendingPromises = Infinity, maxQueuedPromises = Infinity) {
    this.pendingPromises = 0;
    this.maxPendingPromises = maxPendingPromises;
    this.maxQueuedPromises = maxQueuedPromises;
    this.queue = new Deque();
    this.length = 0;
  }

  /**
   * Pause queue processing
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume queue processing
   */
  unpause() {
    this._paused = false;
    this._dequeue();
  }

  /**
   * Adds new promise generator in the queue
   * @param {Function} promiseGenerator
   */
  add(promiseGenerator, unshift = false) {
    return new Promise((resolve, reject) => {
      if (this.length >= this.maxQueuedPromises) {
        reject(new Error('Queue limit reached'));
      } else {
        const queueItem = {
          promiseGenerator: promiseGenerator,
          resolve: resolve,
          reject: reject,
        };

        if (!unshift) {
          this.queue.push(queueItem);
        } else {
          this.queue.unshift(queueItem);
        }

        this.length += 1;
        this._dequeue();
      }
    });
  }

  /**
   * Internal queue processor. Starts processing of
   * the next queued function
   * @return {Boolean}
   */
  _dequeue() {
    if (this._paused || this.pendingPromises >= this.maxPendingPromises) {
      return false;
    }

    const item = this.queue.shift();
    if (!item) {
      return false;
    }

    const result = _try(() => {
      this.pendingPromises++;
      return Promise.resolve()
      .then(() => item.promiseGenerator())
      .then(
        (value) => {
          this.length--;
          this.pendingPromises--;
          item.resolve(value);
          this._dequeue();
        },
        (err) => {
          this.length--;
          this.pendingPromises--;
          item.reject(err);
          this._dequeue();
        }
      );
    });

    if (result instanceof Error) {
      this.length--;
      this.pendingPromises--;
      item.reject(result);
      this._dequeue();
    }

    return true;
  }
}
