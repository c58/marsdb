'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectionIndex = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CollectionIndex = exports.CollectionIndex = function () {
  function CollectionIndex(keyName) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, CollectionIndex);

    (0, _invariant2.default)(keyName, 'CollectionIndex(...): you must specify a field name for indexing');
    (0, _invariant2.default)(!Array.isArray(keyName), 'CollectionIndex(...): compound index is not supported yet');

    this.keyName = keyName;
    this.unique = options.unique || false;
    this.sparse = true; // options.sparse || true; - coming soon
  }

  _createClass(CollectionIndex, [{
    key: 'reset',
    value: function reset() {
      // TODO
    }
  }, {
    key: 'insert',
    value: function insert(doc) {
      // TODO
    }
  }, {
    key: 'remove',
    value: function remove(doc) {
      // TODO
    }
  }, {
    key: 'update',
    value: function update(oldDoc, newDoc) {
      // TODO
    }
  }, {
    key: 'getMatching',
    value: function getMatching(value) {
      // TODO
    }
  }, {
    key: 'getBetweenBounds',
    value: function getBetweenBounds(query) {
      // TODO
    }
  }, {
    key: 'getAll',
    value: function getAll(options) {
      // TODO
    }
  }]);

  return CollectionIndex;
}();

exports.default = CollectionIndex;