'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.joinAll = undefined;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _bind2 = require('fast.js/function/bind');

var _bind3 = _interopRequireDefault(_bind2);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var joinAll = exports.joinAll = {
  method: function method(joinFn) {
    (0, _invariant2.default)(typeof joinFn === 'function', 'joinAll(...): argument must be a function');

    this._addPipeline('joinAll', joinFn);
    return this;
  },

  process: function process(docs, pipeObj, cursor) {
    var i = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];
    var len = arguments.length <= 4 || arguments[4] === undefined ? 1 : arguments[4];

    var updatedFn = cursor._propagateUpdate ? (0, _bind3.default)(cursor._propagateUpdate, cursor) : function () {};

    var res = pipeObj.value(docs, updatedFn, i, len);
    res = _checkTypes2.default.array(res) ? res : [res];
    res = (0, _map3.default)(res, function (val) {
      var cursorPromise = undefined;
      if (val && val.joinAll) {
        // instanceof Cursor
        cursorPromise = val.exec();
      } else if (_checkTypes2.default.object(val) && val.cursor && val.then) {
        cursorPromise = val;
      }
      if (cursorPromise) {
        cursor._trackChildCursorPromise(cursorPromise);
      }
      return cursorPromise || val;
    });

    return Promise.all(res).then(function () {
      return docs;
    });
  }
};