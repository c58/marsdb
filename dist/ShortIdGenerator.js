'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (modelName) {
  var nextSeed = _Random2.default.default().hexString(20);
  var sequenceSeed = [nextSeed, '/collection/' + modelName];
  return {
    value: _Random2.default.createWithSeeds.apply(null, sequenceSeed).id(17),
    seed: nextSeed
  };
};

var _Random = require('./Random');

var _Random2 = _interopRequireDefault(_Random);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }