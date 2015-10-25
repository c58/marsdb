'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _lodashObjectKeys = require('lodash/object/keys');

var _lodashObjectKeys2 = _interopRequireDefault(_lodashObjectKeys);

var _lodashFunctionDefer = require('lodash/function/defer');

var _lodashFunctionDefer2 = _interopRequireDefault(_lodashFunctionDefer);

var _eventemitter3 = require('eventemitter3');

var _eventemitter32 = _interopRequireDefault(_eventemitter3);

var _PromiseQueue = require('./PromiseQueue');

var _PromiseQueue2 = _interopRequireDefault(_PromiseQueue);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

/**
 * Manager for dealing with backend storage
 * of the daatabase. Default implementation uses
 * memory. You can implement the same interface
 * and use another storage (with levelup, for example)
 */

var StorageManager = (function () {
  function StorageManager(db, options) {
    _classCallCheck(this, StorageManager);

    this.db = db;
    this._queue = new _PromiseQueue2['default']();
    this._storage = {};
    this.reload();
  }

  _createClass(StorageManager, [{
    key: 'loaded',
    value: function loaded() {
      return this._loadedPromise;
    }
  }, {
    key: 'reload',
    value: function reload() {
      var _this = this;

      if (this._loadedPromise) {
        this._loadedPromise = this._loadedPromise.then(function () {
          return _this._loadStorage();
        });
      } else {
        this._loadedPromise = this._loadStorage();
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var _this2 = this;

      return this._loadedPromise.then(function () {
        _this2._storage = {};
      });
    }
  }, {
    key: 'persist',
    value: function persist(key, value) {
      var _this3 = this;

      return this._loadedPromise.then(function () {
        _this3._storage[key] = _EJSON2['default'].clone(value);
      });
    }
  }, {
    key: 'delete',
    value: function _delete(key) {
      var _this4 = this;

      return this._loadedPromise.then(function () {
        delete _this4._storage[key];
      });
    }
  }, {
    key: 'get',
    value: function get(key) {
      var _this5 = this;

      return this._loadedPromise.then(function () {
        return _EJSON2['default'].clone(_this5._storage[key]);
      });
    }
  }, {
    key: 'createReadStream',
    value: function createReadStream() {
      var _this6 = this;

      var emitter = new _eventemitter32['default']();
      (0, _lodashFunctionDefer2['default'])(function () {
        _this6._loadedPromise.then(function () {
          (0, _lodashObjectKeys2['default'])(_this6._storage).forEach(function (k) {
            emitter.emit('data', { value: _EJSON2['default'].clone(_this6._storage[k]) });
          });
          emitter.emit('end');
        });
      });
      return emitter;
    }
  }, {
    key: '_loadStorage',
    value: function _loadStorage() {
      return Promise.resolve();
    }
  }]);

  return StorageManager;
})();

exports.StorageManager = StorageManager;
exports['default'] = StorageManager;