var gulp = require('gulp')
  , mocha = require('gulp-mocha')
  , babel = require('gulp-babel');

gulp.task('default', ['test'], build);

gulp.task('test', function() {
  gulp.src('test/*.js', {
      read: false
    })
    .pipe(mocha({
      reporter: 'dot'
    }));
});

function build(){
  gulp.src('es6/**.js')
    .pipe(babel())
    .pipe(gulp.dest('es5'));
}
