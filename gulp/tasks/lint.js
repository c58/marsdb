'use strict';

var config = require('../config');
var gulp   = require('gulp');
var eslint = require('gulp-eslint');

gulp.task('lint', function() {
  return gulp.src([config.src])
    .pipe(eslint())
    .pipe(eslint.format())
    //.pipe(eslint.failOnError());
});