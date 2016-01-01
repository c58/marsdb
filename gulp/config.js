'use strict';

module.exports = {
  src: 'lib/**/*',
  dist: 'dist',
  build: 'build',

  browser: {
    bundleName: 'marsdb.js',
    bundleMinName: 'marsdb.min.js',
    bundlePolyfillsName: 'marsdb.polyfills.js',
    entry: 'index.js',
    entryTests: 'browser_tests.js',
    entryPolyfills: 'polyfills.js',
  }
};
