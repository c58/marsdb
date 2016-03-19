'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.filter = undefined;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var filter = exports.filter = {
  method: function method(filterFn) {
    (0, _invariant2.default)(typeof filterFn === 'function', 'filter(...): argument must be a function');

    this._addPipeline('filter', filterFn);
    return this;
  },

  process: function process(docs, pipeObj) {
    return (0, _filter3.default)(docs, pipeObj.value);
  }
};