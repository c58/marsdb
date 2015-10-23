'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { var object = _x2, property = _x3, receiver = _x4; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _localforage = require('localforage');

var _localforage2 = _interopRequireDefault(_localforage);

/**
 * LocalForage storage implementation. It uses
 * basic in-memory implementaion for fastest
 * iterating and just sync any operation with
 * a storage.
 */
var StorageManager = typeof window !== 'undefined' && window.Mars ? window.Mars.StorageManager : require('../StorageManager')['default'];
var EJSON = typeof window !== 'undefined' && window.Mars ? window.Mars.EJSON : require('../EJSON')['default'];

var LocalForageManager = (function (_StorageManager) {
  _inherits(LocalForageManager, _StorageManager);

  function LocalForageManager(db) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, LocalForageManager);

    _get(Object.getPrototypeOf(LocalForageManager.prototype), 'constructor', this).call(this, db, options);
    this.forage = (0, _localforage2['default'])(db.modelName);
  }

  _createClass(LocalForageManager, [{
    key: 'destroy',
    value: function destroy() {
      var _this = this;

      return this._queue.push(function (resolve, reject) {
        Promise.all(Object.keys(_this._storage).map(function (key) {
          return _this.forage.removeItem(key);
        })).then(function () {
          return _get(Object.getPrototypeOf(LocalForageManager.prototype), 'destroy', _this).call(_this);
        }).then(resolve, reject);
      });
    }
  }, {
    key: 'persist',
    value: function persist(key, value) {
      var _this2 = this;

      return _get(Object.getPrototypeOf(LocalForageManager.prototype), 'persist', this).call(this, key, value).then(function () {
        return _this2._queue.push(function (resolve, reject) {
          _this2.forage.setItem(key, EJSON.stringify(value)).then(resolve, reject);
        });
      });
    }
  }, {
    key: 'delete',
    value: function _delete(key) {
      var _this3 = this;

      return _get(Object.getPrototypeOf(LocalForageManager.prototype), 'delete', this).call(this, key).then(function () {
        return _this3._queue.push(function (resolve, reject) {
          _this3.forage.removeItem(key).then(resolve, reject);
        });
      });
    }
  }, {
    key: '_loadStorage',
    value: function _loadStorage() {
      return this._queue.push(function (resolve, reject) {
        // TODO
      });
    }
  }]);

  return LocalForageManager;
})(StorageManager);

exports['default'] = LocalForageManager;
module.exports = exports['default'];