'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.join = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _joinObj = require('./joinObj');

var _joinEach = require('./joinEach');

var _joinAll = require('./joinAll');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var join = exports.join = {
  method: function method(joinFn) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    (0, _invariant2.default)(typeof joinFn === 'function' || _checkTypes2.default.object(joinFn), 'join(...): argument must be a function');

    this._addPipeline('join', joinFn, options);
    return this;
  },

  process: function process(docs, pipeObj, cursor) {
    if (_checkTypes2.default.object(pipeObj.value)) {
      return _joinObj.joinObj.process(docs, pipeObj, cursor);
    } else if (_checkTypes2.default.array(docs)) {
      return _joinEach.joinEach.process(docs, pipeObj, cursor);
    } else {
      return _joinAll.joinAll.process(docs, pipeObj, cursor);
    }
  }
};