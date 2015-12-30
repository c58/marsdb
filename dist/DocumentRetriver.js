'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DocumentRetriver = undefined;

var _isObject2 = require('lodash/lang/isObject');

var _isObject3 = _interopRequireDefault(_isObject2);

var _isArray2 = require('lodash/lang/isArray');

var _isArray3 = _interopRequireDefault(_isArray2);

var _has2 = require('lodash/object/has');

var _has3 = _interopRequireDefault(_has2);

var _size2 = require('lodash/collection/size');

var _size3 = _interopRequireDefault(_size2);

var _Document = require('./Document');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Class for getting data objects by given list of ids.
 * Promises based. It makes requests asyncronousle by
 * getting request frame from database.
 * It's not use caches, because it's a task of store.
 * It just retrives content by 'get' method.
 */

var DocumentRetriver = exports.DocumentRetriver = (function () {
  function DocumentRetriver(db) {
    _classCallCheck(this, DocumentRetriver);

    this.db = db;
  }

  /**
   * Retrive an optimal superset of documents
   * by given query based on _id field of the query
   * @param  {Object} query
   * @return {Promise}
   */

  _createClass(DocumentRetriver, [{
    key: 'retriveForQeury',
    value: function retriveForQeury(query) {
      // Try to get list of ids
      var selectorIds = undefined;
      if ((0, _Document.selectorIsId)(query)) {
        // fast path for scalar query
        selectorIds = [query];
      } else if ((0, _Document.selectorIsIdPerhapsAsObject)(query)) {
        // also do the fast path for { _id: idString }
        selectorIds = [query._id];
      } else if ((0, _isObject3.default)(query) && (0, _has3.default)(query, '_id') && (0, _isObject3.default)(query._id) && (0, _has3.default)(query._id, '$in') && (0, _isArray3.default)(query._id.$in)) {
        // and finally fast path for multiple ids
        // selected by $in operator
        selectorIds = query._id.$in;
      }

      // Retrive optimally
      if ((0, _size3.default)(selectorIds) > 0) {
        return this.retriveIds(selectorIds);
      } else {
        return this.retriveAll();
      }
    }

    /**
     * Retrive all documents in the storage of
     * the collection
     * @return {Promise}
     */

  }, {
    key: 'retriveAll',
    value: function retriveAll() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        var result = [];
        _this.db.storage.createReadStream().on('data', function (data) {
          return result.push(_this.db.create(data.value));
        }).on('end', function () {
          return resolve(result);
        });
      });
    }

    /**
     * Rterive all ids given in constructor.
     * If some id is not retrived (retrived qith error),
     * then returned promise will be rejected with that error.
     * @return {Promise}
     */

  }, {
    key: 'retriveIds',
    value: function retriveIds(ids) {
      var _this2 = this;

      var retrPromises = ids.map(function (id) {
        return _this2.retriveOne(id);
      });
      return Promise.all(retrPromises);
    }

    /**
     * Retrive one document by given id
     * @param  {String} id
     * @return {Promise}
     */

  }, {
    key: 'retriveOne',
    value: function retriveOne(id) {
      var _this3 = this;

      return this.db.storage.get(id).then(function (buf) {
        return _this3.db.create(buf);
      });
    }
  }]);

  return DocumentRetriver;
})();

exports.default = DocumentRetriver;