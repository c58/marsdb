'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _try2 = require('fast.js/function/try');

var _try3 = _interopRequireDefault(_try2);

var _doubleEndedQueue = require('double-ended-queue');

var _doubleEndedQueue2 = _interopRequireDefault(_doubleEndedQueue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * It limits concurrently executed promises
 *
 * @param {Number} [maxPendingPromises=Infinity] max number of concurrently executed promises
 * @param {Number} [maxQueuedPromises=Infinity]  max number of queued promises
 * @constructor
 */

var PromiseQueue = function () {
  function PromiseQueue() {
    var maxPendingPromises = arguments.length <= 0 || arguments[0] === undefined ? Infinity : arguments[0];
    var maxQueuedPromises = arguments.length <= 1 || arguments[1] === undefined ? Infinity : arguments[1];

    _classCallCheck(this, PromiseQueue);

    this.pendingPromises = 0;
    this.maxPendingPromises = maxPendingPromises;
    this.maxQueuedPromises = maxQueuedPromises;
    this.queue = new _doubleEndedQueue2.default();
    this.length = 0;
  }

  /**
   * Pause queue processing
   */

  _createClass(PromiseQueue, [{
    key: 'pause',
    value: function pause() {
      this._paused = true;
    }

    /**
     * Resume queue processing
     */

  }, {
    key: 'unpause',
    value: function unpause() {
      this._paused = false;
      this._dequeue();
    }

    /**
     * Adds new promise generator in the queue
     * @param {Function} promiseGenerator
     */

  }, {
    key: 'add',
    value: function add(promiseGenerator) {
      var _this = this;

      var unshift = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      return new Promise(function (resolve, reject) {
        if (_this.length >= _this.maxQueuedPromises) {
          reject(new Error('Queue limit reached'));
        } else {
          var queueItem = {
            promiseGenerator: promiseGenerator,
            resolve: resolve,
            reject: reject
          };

          if (!unshift) {
            _this.queue.push(queueItem);
          } else {
            _this.queue.unshift(queueItem);
          }

          _this.length += 1;
          _this._dequeue();
        }
      });
    }

    /**
     * Internal queue processor. Starts processing of
     * the next queued function
     * @return {Boolean}
     */

  }, {
    key: '_dequeue',
    value: function _dequeue() {
      var _this2 = this;

      if (this._paused || this.pendingPromises >= this.maxPendingPromises) {
        return false;
      }

      var item = this.queue.shift();
      if (!item) {
        return false;
      }

      var result = (0, _try3.default)(function () {
        _this2.pendingPromises++;
        return Promise.resolve().then(function () {
          return item.promiseGenerator();
        }).then(function (value) {
          _this2.length--;
          _this2.pendingPromises--;
          item.resolve(value);
          _this2._dequeue();
        }, function (err) {
          _this2.length--;
          _this2.pendingPromises--;
          item.reject(err);
          _this2._dequeue();
        });
      });

      if (result instanceof Error) {
        this.length--;
        this.pendingPromises--;
        item.reject(result);
        this._dequeue();
      }

      return true;
    }
  }]);

  return PromiseQueue;
}();

exports.default = PromiseQueue;