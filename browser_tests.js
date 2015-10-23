require('./polyfills');
var bulk = require('bulk-require');


mocha.ui('bdd');
mocha.reporter('html');
var tests = bulk(__dirname, ['./test/both/*.test.js', './test/browser/*.test.js']);
mocha.run();
