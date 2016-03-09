'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ifNotEmpty = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ifNotEmpty = exports.ifNotEmpty = {
  method: function method() {
    this._addPipeline('ifNotEmpty');
    return this;
  },

  process: function process(docs) {
    var isEmptyRes = !_checkTypes2.default.assigned(docs) || _checkTypes2.default.array(docs) && _checkTypes2.default.emptyArray(docs) || _checkTypes2.default.object(docs) && _checkTypes2.default.emptyObject(docs);
    return isEmptyRes ? '___[STOP]___' : docs;
  }
};