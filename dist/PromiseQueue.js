'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _async = require('async');

/**
 * Queue that resolves a Promise when task
 * is done or rejected if errored.
 */

var PromiseQueue = (function () {
  function PromiseQueue() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, PromiseQueue);

    this._queue = (0, _async.queue)(this._operationWorker.bind(this), options.concurrency || 1);
  }

  _createClass(PromiseQueue, [{
    key: 'push',
    value: function push(task) {
      var _this = this;

      var priority = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];

      return new Promise(function (resolve, reject) {
        _this._queue.push(function () {
          return new Promise(task);
        }, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }, {
    key: '_operationWorker',
    value: function _operationWorker(task, next) {
      task().then(next, next);
    }
  }]);

  return PromiseQueue;
})();

exports.PromiseQueue = PromiseQueue;
exports['default'] = PromiseQueue;