'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectionDelegate = undefined;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _DocumentModifier = require('./DocumentModifier');

var _DocumentModifier2 = _interopRequireDefault(_DocumentModifier);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Default collection delegate for working with a
 * normal MarsDB approach – within a browser.
 */

var CollectionDelegate = exports.CollectionDelegate = function () {
  function CollectionDelegate(db) {
    _classCallCheck(this, CollectionDelegate);

    this.db = db;
  }

  _createClass(CollectionDelegate, [{
    key: 'insert',
    value: function insert(doc) {
      var _this = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var randomId = arguments[2];

      return this.db.indexManager.indexDocument(doc).then(function () {
        return _this.db.storageManager.persist(doc._id, doc).then(function () {
          return doc._id;
        });
      });
    }
  }, {
    key: 'remove',
    value: function remove(query, _ref) {
      var _this2 = this;

      var _ref$sort = _ref.sort;
      var sort = _ref$sort === undefined ? { _id: 1 } : _ref$sort;
      var _ref$multi = _ref.multi;
      var multi = _ref$multi === undefined ? false : _ref$multi;

      return this.find(query, { noClone: true }).sort(sort).then(function (docs) {
        if (docs.length > 1 && !multi) {
          docs = [docs[0]];
        }
        var removeStorgePromises = (0, _map3.default)(docs, function (d) {
          return _this2.db.storageManager.delete(d._id);
        });
        var removeIndexPromises = (0, _map3.default)(docs, function (d) {
          return _this2.db.indexManager.deindexDocument(d);
        });
        return Promise.all([].concat(_toConsumableArray(removeStorgePromises), _toConsumableArray(removeIndexPromises))).then(function () {
          return docs;
        });
      });
    }
  }, {
    key: 'update',
    value: function update(query, modifier, _ref2) {
      var _this3 = this;

      var _ref2$sort = _ref2.sort;
      var sort = _ref2$sort === undefined ? { _id: 1 } : _ref2$sort;
      var _ref2$multi = _ref2.multi;
      var multi = _ref2$multi === undefined ? false : _ref2$multi;
      var _ref2$upsert = _ref2.upsert;
      var upsert = _ref2$upsert === undefined ? false : _ref2$upsert;

      return this.find(query, { noClone: true }).sort(sort).then(function (docs) {
        if (docs.length > 1 && !multi) {
          docs = [docs[0]];
        }
        return new _DocumentModifier2.default(query).modify(docs, modifier, { upsert: upsert });
      }).then(function (_ref3) {
        var original = _ref3.original;
        var updated = _ref3.updated;

        var updateStorgePromises = (0, _map3.default)(updated, function (d) {
          return _this3.db.storageManager.persist(d._id, d);
        });
        var updateIndexPromises = (0, _map3.default)(updated, function (d, i) {
          return _this3.db.indexManager.reindexDocument(original[i], d);
        });
        return Promise.all([].concat(_toConsumableArray(updateStorgePromises), _toConsumableArray(updateIndexPromises))).then(function () {
          return {
            modified: updated.length,
            original: original,
            updated: updated
          };
        });
      });
    }
  }, {
    key: 'find',
    value: function find(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var cursorClass = this.db.cursorClass;
      return new cursorClass(this.db, query, options);
    }
  }, {
    key: 'findOne',
    value: function findOne(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.find(query, options).aggregate(function (docs) {
        return docs[0];
      }).limit(1);
    }
  }, {
    key: 'count',
    value: function count(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      options.noClone = true;
      return this.find(query, options).aggregate(function (docs) {
        return docs.length;
      });
    }
  }, {
    key: 'ids',
    value: function ids(query) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      options.noClone = true;
      return this.find(query, options).map(function (doc) {
        return doc._id;
      });
    }
  }]);

  return CollectionDelegate;
}();

exports.default = CollectionDelegate;