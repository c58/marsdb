'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.aggregate = undefined;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var aggregate = exports.aggregate = {
  method: function method(aggrFn) {
    (0, _invariant2.default)(typeof aggrFn === 'function', 'aggregate(...): aggregator must be a function');

    this._addPipeline('aggregate', aggrFn);
    return this;
  },

  process: function process(docs, pipeObj) {
    return pipeObj.value(docs);
  }
};