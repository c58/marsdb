var Collection = require('./dist/Collection').default;
var CursorObservable = require('./dist/CursorObservable').default;
var StorageManager = require('./dist/StorageManager').default;
var Random = require('./dist/Random').default;
var EJSON = require('./dist/EJSON').default;
var Base64 = require('./dist/Base64').default;


module.exports = {
  __esModule: true,
  default: Collection,
  Random: Random,
  EJSON: EJSON,
  Base64: Base64,
  Collection: Collection,
  CursorObservable: CursorObservable,
  StorageManager: StorageManager,
};
