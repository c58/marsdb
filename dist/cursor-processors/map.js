'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.map = undefined;

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var map = exports.map = {
  method: function method(mapperFn) {
    (0, _invariant2.default)(typeof mapperFn === 'function', 'map(...): mapper must be a function');

    this._addPipeline('map', mapperFn);
    return this;
  },

  process: function process(docs, pipeObj) {
    return (0, _map3.default)(docs, pipeObj.value);
  }
};