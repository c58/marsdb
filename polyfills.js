if (typeof window !== 'undefined') {
  window.Symbol = require("core-js/es6/symbol");
  window.Promise = require("core-js/es6/promise");
  window.Set = require("core-js/es6/set");
  window.Map = require("core-js/es6/map");
} else {
  global.Symbol = require("core-js/es6/symbol");
  global.Promise = require("core-js/es6/promise");
  global.Set = require("core-js/es6/set");
  global.Map = require("core-js/es6/map");
}