var gulp = require('gulp'),
  mocha = require('gulp-mocha');

gulp.task('default', ['test']);

gulp.task('test', function() {
  gulp.src('test/*.js', {
      read: false
    })
    .pipe(mocha({
      reporter: 'dot'
    }));
});
