'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectionDelegate = undefined;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _DocumentModifier = require('./DocumentModifier');

var _DocumentModifier2 = _interopRequireDefault(_DocumentModifier);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Default collection delegate for working with a
 * normal MarsDB approach – within a browser.
 */

var CollectionDelegate = exports.CollectionDelegate = (function () {
  function CollectionDelegate(db) {
    _classCallCheck(this, CollectionDelegate);

    this.db = db;
  }

  _createClass(CollectionDelegate, [{
    key: 'insert',
    value: function insert(doc) {
      var _this = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.db.indexManager.indexDocument(doc).then(function () {
        return _this.db.storageManager.persist(doc._id, doc).then(function () {
          return doc._id;
        });
      });
    }
  }, {
    key: 'remove',
    value: function remove(query) {
      var _this2 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.find(query, { noClone: true }).then(function (docs) {
        (0, _invariant2.default)(docs.length <= 1 || options.multi, 'remove(..): multi removing is not enabled by options.multi');

        var removeStorgePromises = (0, _map3.default)(docs, function (d) {
          return _this2.db.storageManager.delete(d._id);
        });
        var removeIndexPromises = (0, _map3.default)(docs, function (d) {
          return _this2.db.indexManager.deindexDocument(d);
        });
        var allPromises = removeStorgePromises.concat(removeIndexPromises);

        return Promise.all(allPromises).then(function () {
          return docs;
        });
      });
    }
  }, {
    key: 'update',
    value: function update(query, modifier) {
      var _this3 = this;

      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      options.upsert = false;
      return new _DocumentModifier2.default(this.db, query).modify(modifier, options).then(function (result) {
        var original = result.original;
        var updated = result.updated;

        updated = (0, _map3.default)(updated, function (x) {
          return _this3.db.create(x);
        });

        var updateStorgePromises = (0, _map3.default)(updated, function (d) {
          return _this3.db.storageManager.persist(d._id, d);
        });
        var updateIndexPromises = (0, _map3.default)(updated, function (d, i) {
          return _this3.db.indexManager.reindexDocument(original[i], d);
        });
        var allPromises = updateStorgePromises.concat(updateIndexPromises);

        return Promise.all(allPromises).then(function () {
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

      return new this.db.cursorClass(this.db, query, options);
    }
  }, {
    key: 'findOne',
    value: function findOne(query, sortObj) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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
})();

exports.default = CollectionDelegate;