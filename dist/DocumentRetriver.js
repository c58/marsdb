'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DocumentRetriver = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

var _Document = require('./Document');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internals
var DEFAULT_QUERY_FILTER = function DEFAULT_QUERY_FILTER() {
  return true;
};

/**
 * Class for getting data objects by given list of ids.
 * Promises based. It makes requests asyncronousle by
 * getting request frame from database.
 * It's not use caches, because it's a task of store.
 * It just retrives content by 'get' method.
 */

var DocumentRetriver = exports.DocumentRetriver = function () {
  function DocumentRetriver(db) {
    _classCallCheck(this, DocumentRetriver);

    this.db = db;
  }

  /**
   * Retrive an optimal superset of documents
   * by given query based on _id field of the query
   *
   * TODO: there is a place for indexes
   *
   * @param  {Object} query
   * @return {Promise}
   */

  _createClass(DocumentRetriver, [{
    key: 'retriveForQeury',
    value: function retriveForQeury(query) {
      var queryFilter = arguments.length <= 1 || arguments[1] === undefined ? DEFAULT_QUERY_FILTER : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      // Try to get list of ids
      var selectorIds = undefined;
      if ((0, _Document.selectorIsId)(query)) {
        // fast path for scalar query
        selectorIds = [query];
      } else if ((0, _Document.selectorIsIdPerhapsAsObject)(query)) {
        // also do the fast path for { _id: idString }
        selectorIds = [query._id];
      } else if (_checkTypes2.default.object(query) && query.hasOwnProperty('_id') && _checkTypes2.default.object(query._id) && query._id.hasOwnProperty('$in') && _checkTypes2.default.array(query._id.$in)) {
        // and finally fast path for multiple ids
        // selected by $in operator
        selectorIds = query._id.$in;
      }

      // Retrive optimally
      if (_checkTypes2.default.array(selectorIds) && selectorIds.length > 0) {
        return this.retriveIds(queryFilter, selectorIds, options);
      } else {
        return this.retriveAll(queryFilter, options);
      }
    }

    /**
     * Rterive all ids given in constructor.
     * If some id is not retrived (retrived qith error),
     * then returned promise will be rejected with that error.
     * @return {Promise}
     */

  }, {
    key: 'retriveAll',
    value: function retriveAll() {
      var _this = this;

      var queryFilter = arguments.length <= 0 || arguments[0] === undefined ? DEFAULT_QUERY_FILTER : arguments[0];
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var limit = options.limit || +Infinity;
      var result = [];
      var stopped = false;

      return new Promise(function (resolve, reject) {
        var stream = _this.db.storage.createReadStream();

        stream.on('data', function (data) {
          // After deleting of an item some storages
          // may return an undefined for a few times.
          // We need to check it there.
          if (!stopped && data.value) {
            var doc = _this.db.create(data.value);
            if (result.length < limit && queryFilter(doc)) {
              result.push(doc);
            }
            // Limit the result if storage supports it
            if (result.length === limit && stream.pause) {
              stream.pause();
              resolve(result);
              stopped = true;
            }
          }
        }).on('end', function () {
          return !stopped && resolve(result);
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
    value: function retriveIds() {
      var queryFilter = arguments.length <= 0 || arguments[0] === undefined ? DEFAULT_QUERY_FILTER : arguments[0];

      var _this2 = this;

      var ids = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var uniqIds = (0, _filter3.default)(ids, function (id, i) {
        return ids.indexOf(id) === i;
      });
      var retrPromises = (0, _map3.default)(uniqIds, function (id) {
        return _this2.retriveOne(id);
      });
      var limit = options.limit || +Infinity;

      return Promise.all(retrPromises).then(function (res) {
        var filteredRes = [];

        for (var i = 0; i < res.length; i++) {
          var doc = res[i];
          if (doc && queryFilter(doc)) {
            filteredRes.push(doc);
            if (filteredRes.length === limit) {
              break;
            }
          }
        }

        return filteredRes;
      });
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
}();

exports.default = DocumentRetriver;