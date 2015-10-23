const CursorObservable = typeof window !== 'undefined' && window.Mars
  ? window.Mars.CursorObservable : require('../CursorObservable').default;


export class AngularCursorObservable extends CursorObservable {
  constructor(db, query) {
    super(db._collection, query);
    this.$q = db.$q;
  }

  /**
   * Stop observing given cursor, if passed and
   * observing.
   * It might be useful when you need to replace
   * previously created request with another one
   * (with different query, for example).
   *
   * @param  {CursorObservable} cursor
   */
  destroy(cursor) {
    if (cursor && cursor._prevStopper) {
      cursor._prevStopper.stop();
    }
  }

  /**
   * Original `observe` with one additional argument.
   * Second argument, if passed, a $scope for tracking
   * $destroy event and stopping observing when event
   * emited.
   *
   * @param  {Function} fn
   * @param  {Scope}   $scope
   * @return {Stooper}
   */
  observe(fn, $scope) {
    const stopper = super.observe(fn);
    if ($scope) {
      $scope.$on('$destroy', function() {
        stopper.stop();
      });
    }

    this._prevStopper = stopper;
    return stopper;
  }

  exec(...args) {
    return this.$q.resolve(super.exec(...args));
  }

  ids(...args) {
    return this.$q.resolve(super.ids(...args));
  }

  update(...args) {
    return this.$q.resolve(super.update(...args));
  }
}

export default AngularCursorObservable;
