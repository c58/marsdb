'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Extension of a regular EventEmitter that provides a method
 * that returns a Promise then resolved when all listeners of the event
 * will be resolved.
 */
/* istanbul ignore next */

var AsyncEventEmitter = function (_EventEmitter) {
  _inherits(AsyncEventEmitter, _EventEmitter);

  function AsyncEventEmitter() {
    _classCallCheck(this, AsyncEventEmitter);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(AsyncEventEmitter).apply(this, arguments));
  }

  _createClass(AsyncEventEmitter, [{
    key: 'emitAsync',

    /**
     * Emit an event and return a Promise that will be resolved
     * when all listeren's Promises will be resolved.
     * @param  {String} event
     * @return {Promise}
     */
    value: function emitAsync(event, a1, a2, a3, a4, a5) {
      var prefix = _eventemitter2.default.prefixed;
      var evt = prefix ? prefix + event : event;

      if (!this._events || !this._events[evt]) {
        return Promise.resolve();
      }

      var i = undefined;
      var listeners = this._events[evt];
      var len = arguments.length;
      var args = undefined;

      if ('function' === typeof listeners.fn) {
        if (listeners.once) {
          this.removeListener(event, listeners.fn, undefined, true);
        }

        switch (len) {
          case 1:
            return Promise.resolve(listeners.fn.call(listeners.context));
          case 2:
            return Promise.resolve(listeners.fn.call(listeners.context, a1));
          case 3:
            return Promise.resolve(listeners.fn.call(listeners.context, a1, a2));
          case 4:
            return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3));
          case 5:
            return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4));
          case 6:
            return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4, a5));
        }

        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        return Promise.resolve(listeners.fn.apply(listeners.context, args));
      } else {
        var promises = [];
        var length = listeners.length;
        var j = undefined;

        for (i = 0; i < length; i++) {
          if (listeners[i].once) {
            this.removeListener(event, listeners[i].fn, undefined, true);
          }

          switch (len) {
            case 1:
              promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context)));break;
            case 2:
              promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1)));break;
            case 3:
              promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1, a2)));break;
            default:
              if (!args) {
                for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
              }
              promises.push(Promise.resolve(listeners[i].fn.apply(listeners[i].context, args)));
          }
        }

        return Promise.all(promises);
      }
    }
  }]);

  return AsyncEventEmitter;
}(_eventemitter2.default);

exports.default = AsyncEventEmitter;