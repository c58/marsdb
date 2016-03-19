'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reduce = undefined;

var _reduce2 = require('fast.js/array/reduce');

var _reduce3 = _interopRequireDefault(_reduce2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var reduce = exports.reduce = {
  method: function method(reduceFn, initial) {
    (0, _invariant2.default)(typeof reduceFn === 'function', 'reduce(...): reducer argument must be a function');

    this._addPipeline('reduce', reduceFn, initial);
    return this;
  },

  process: function process(docs, pipeObj) {
    return (0, _reduce3.default)(docs, pipeObj.value, pipeObj.args[0]);
  }
};