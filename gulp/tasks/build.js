'use strict';

var gulp = require('gulp');
var babel = require('gulp-babel');
var config = require('../config');
var gulpif = require('gulp-if');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var babelify = require('babelify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var path = require('path');


gulp.task('build', [
  'build:browser',
  'build:browser:angular',
  'build:browser:localStorage',
  'build:browser:localForage',
  'build:browser:min',
  'build:browser:tests',
  'build:browser:polyfills',
  'build:node'
]);

gulp.task('build:node', function() {
  return gulp.src(config.src)
    .pipe(babel({
      comments: true,
      compact: false,
      blacklist: [
        'spec.functionName',
      ],
      optional: [
        'es7.trailingFunctionCommas',
      ]
    }))
    .pipe(gulp.dest(config.dist));
});

gulp.task('build:browser:min', ['build:browser'], function() {
  return gulp.src(path.join(config.build, config.browser.bundleName))
    .pipe(rename(config.browser.bundleMinName))
    .pipe(uglify())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser:polyfills', function() {
  var customOpts = {
    entries: config.browser.entryPolyfills,
    debug: false,
    fullPaths: false
  };

  return browserify(customOpts).bundle()
    .pipe(source(config.browser.bundlePolyfillsName))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser:angular', ['build:node'], function() {
  var customOpts = {
    entries: config.browser.entryAngular,
    debug: false,
    fullPaths: false
  };

  return browserify(customOpts)
    .exclude('../Collection')
    .exclude('../CursorObservable')
    .exclude('angular')
    .bundle()
    .pipe(source(config.browser.bundleAngularName))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser:localStorage', ['build:node'], function() {
  var customOpts = {
    entries: config.browser.entryLocalStorage,
    debug: false,
    fullPaths: false,
    standalone: 'Mars.Storages.LocalStorage',
  };

  return browserify(customOpts)
    .exclude('../StorageManager')
    .exclude('../EJSON')
    .bundle()
    .pipe(source(config.browser.bundleLocalStorageName))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser:localForage', ['build:node'], function() {
  var customOpts = {
    entries: config.browser.entryLocalForage,
    debug: false,
    fullPaths: false,
    standalone: 'Mars.Storages.LocalForage',
  };

  return browserify(customOpts)
    .exclude('../StorageManager')
    .exclude('../EJSON')
    .bundle()
    .pipe(source(config.browser.bundleLocalForageName))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser:tests', ['build:node'], function() {
  // Basic options
  var customOpts = {
    entries: './browser_tests.js',
    debug: false,
    fullPaths: false,
    delay: 50
  };
  var b = browserify(customOpts);

  // Transformations
  var transforms = [
    babelify.configure({
      comments: true,
      compact: false,
      blacklist: [
        'spec.functionName',
      ],
      optional: [
        'es7.trailingFunctionCommas',
      ]
    }),
    'brfs',
    'bulkify',
    'envify'
  ];

  transforms.forEach(function(transform) {
    b.transform(transform);
  });

  // Add handlers
  return b.bundle()
    .pipe(source('browser_tests.js'))
    .pipe(buffer())
    .pipe(gulp.dest(config.build))
});

gulp.task('build:browser', ['build:node'], function() {
  var b = browserify({
    entries: config.browser.entry,
    debug: false,
    fullPaths: false,
    delay: 50,
    standalone: 'Mars',
  });

  var transforms = [babelify.configure({}), 'bulkify', 'envify'];
  transforms.forEach(function(transform) {
    b.transform(transform);
  });

  return b.bundle()
    .pipe(source(config.browser.bundleName))
    .pipe(buffer())
    .pipe(gulp.dest(config.build))
});
