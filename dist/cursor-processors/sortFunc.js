'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sortFunc = undefined;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var sortFunc = exports.sortFunc = {
  method: function method(sortFn) {
    (0, _invariant2.default)(typeof sortFn === 'function', 'sortFunc(...): argument must be a function');

    this._addPipeline('sortFunc', sortFn);
    return this;
  },

  process: function process(docs, pipeObj) {
    return docs.sort(pipeObj.value);
  }
};