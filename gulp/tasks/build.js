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
  'build:browser:min',
  'build:browser:tests',
  'build:browser:polyfills',
  'build:node'
]);

gulp.task('build:node', function() {
  return gulp.src(config.src)
    .pipe(babel())
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
    babelify.configure(),
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

  return b
    .exclude('crypto')
    .bundle()
    .pipe(source(config.browser.bundleName))
    .pipe(buffer())
    .pipe(gulp.dest(config.build))
});
