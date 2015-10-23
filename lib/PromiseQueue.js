import {queue as PriorityQueue} from 'async';


/**
 * Queue that resolves a Promise when task
 * is done or rejected if errored.
 */
export class PromiseQueue {
  constructor(options = {}) {
    this._queue = PriorityQueue(
      this._operationWorker.bind(this),
      options.concurrency || 1
    );
  }

  push(task, priority = 1) {
    return new Promise((resolve, reject) => {
      this._queue.push(
        () => new Promise(task),
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  _operationWorker(task, next) {
    task().then(next, next);
  }
}

export default PromiseQueue;
