'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CursorObservable = typeof window !== 'undefined' && window.Mars ? window.Mars.CursorObservable : require('../CursorObservable').default;

var AngularCursorObservable = exports.AngularCursorObservable = (function (_CursorObservable) {
  _inherits(AngularCursorObservable, _CursorObservable);

  function AngularCursorObservable(db, query) {
    _classCallCheck(this, AngularCursorObservable);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AngularCursorObservable).call(this, db._collection, query));

    _this.$q = db.$q;
    return _this;
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
      var stopper = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'observe', this).call(this, fn);
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
      var _get2;

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return this.$q.resolve((_get2 = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'exec', this)).call.apply(_get2, [this].concat(args)));
    }
  }, {
    key: 'ids',
    value: function ids() {
      var _get3;

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return this.$q.resolve((_get3 = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'ids', this)).call.apply(_get3, [this].concat(args)));
    }
  }, {
    key: 'update',
    value: function update() {
      var _get4;

      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      return this.$q.resolve((_get4 = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), 'update', this)).call.apply(_get4, [this].concat(args)));
    }
  }, {
    key: '_prepareListener',
    value: function _prepareListener(listener) {
      var _this2 = this;

      var preparedFn = _get(Object.getPrototypeOf(AngularCursorObservable.prototype), '_prepareListener', this).call(this, listener);
      return function () {
        return _this2.$q.resolve(preparedFn.apply(undefined, arguments)).then(function () {});
      };
    }
  }]);

  return AngularCursorObservable;
})(CursorObservable);

exports.default = AngularCursorObservable;