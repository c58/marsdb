'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CursorObservable = typeof window !== 'undefined' && window.Mars ? window.Mars.CursorObservable : require('../CursorObservable')['default'];

var AngularCursorObservable = (function (_CursorObservable) {
  _inherits(AngularCursorObservable, _CursorObservable);

  function AngularCursorObservable(db, query) {
    _classCallCheck(this, AngularCursorObservable);

    _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'constructor', this).call(this, db._collection, query);
    this.$q = db.$q;
  }

  /**
   * Stop observing given cursor, if passed and
   * observing.
   * It might be useful when you need to replace
   * previously created request with another one
   * (with different query, for example).
   *
   * @param  {CursorObservable} cursor
   */

  _createClass(AngularCursorObservable, [{
    key: 'destroy',
    value: function destroy(cursor) {
      if (cursor && cursor._prevStopper) {
        cursor._prevStopper.stop();
      }
      return this;
    }

    /**
     * Original `observe` with one additional argument.
     * Second argument, if passed, a $scope for tracking
     * $destroy event and stopping observing when event
     * emited.
     *
     * @param  {Function} fn
     * @param  {Scope}   $scope
     * @return {Stooper}
     */
  }, {
    key: 'observe',
    value: function observe(fn, $scope) {
      var _this = this;

      var wrappedFn = function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this.$q(function (resolve) {
          resolve(fn.apply(undefined, args));
        });
      };

      var stopper = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'observe', this).call(this, wrappedFn);
      if ($scope) {
        $scope.$on('$destroy', function () {
          stopper.stop();
        });
      }

      this._prevStopper = stopper;
      return stopper;
    }
  }, {
    key: 'exec',
    value: function exec() {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return this.$q.resolve(_get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'exec', this).apply(this, args));
    }
  }, {
    key: 'ids',
    value: function ids() {
      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      return this.$q.resolve(_get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'ids', this).apply(this, args));
    }
  }, {
    key: 'update',
    value: function update() {
      for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }

      return this.$q.resolve(_get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'update', this).apply(this, args));
    }
  }]);

  return AngularCursorObservable;
})(CursorObservable);

exports.AngularCursorObservable = AngularCursorObservable;
exports['default'] = AngularCursorObservable;