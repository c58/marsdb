'use strict';

module.exports = {
  src: 'lib/**/*',
  dist: 'dist',
  build: 'build',

  browser: {
    bundleName: 'marsdb.js',
    bundleMinName: 'marsdb.min.js',
    bundlePolyfillsName: 'marsdb.polyfills.js',
    bundleAngularName: 'marsdb.angular.js',
    bundleLocalStorageName: 'marsdb.localStorage.js',
    bundleLocalForageName: 'marsdb.localForage.js',
    entry: 'index.js',
    entryTests: 'browser_tests.js',
    entryPolyfills: 'polyfills.js',
    entryAngular: 'dist/angular/index',
    entryLocalStorage: 'dist/storages/LocalStorageManager',
    entryLocalForage: 'dist/storages/LocalForageManager',
  }
};
