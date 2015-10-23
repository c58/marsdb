const CursorObservable = typeof window !== 'undefined' && window.Mars
  ? window.Mars.CursorObservable : require('../CursorObservable').default;


export class AngularCursorObservable extends CursorObservable {
  constructor(db, query) {
    super(db._collection, query);
    this.$q = db.$q;
  }

  observe(fn, $scope) {
    const stopper = super.observe(fn);
    if ($scope) {
      $scope.$on('$destroy', function() {
        stopper.stop();
      });
    }
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
