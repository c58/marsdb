'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.joinEach = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _joinAll = require('./joinAll');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var joinEach = exports.joinEach = {
  method: function method(joinFn) {
    (0, _invariant2.default)(typeof joinFn === 'function', 'joinEach(...): argument must be a function');

    this._addPipeline('joinEach', joinFn);
    return this;
  },

  process: function process(docs, pipeObj, cursor) {
    docs = _checkTypes2.default.array(docs) ? docs : [docs];
    var docsLength = docs.length;
    return Promise.all((0, _map3.default)(docs, function (x, i) {
      return _joinAll.joinAll.process(x, pipeObj, cursor, i, docsLength);
    }));
  }
};