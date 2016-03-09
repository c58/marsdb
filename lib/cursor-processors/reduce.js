import _reduce from 'fast.js/array/reduce';
import invariant from 'invariant';


export const reduce = {
  method: function(reduceFn, initial) {
    invariant(
      typeof reduceFn === 'function',
      'reduce(...): reducer argument must be a function'
    );

    this._addPipeline('reduce', reduceFn, initial);
    return this;
  },

  process: function(docs, pipeObj) {
    return _reduce(docs, pipeObj.value, pipeObj.args[0]);
  },
};
