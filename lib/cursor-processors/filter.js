import invariant from 'invariant';
import _filter from 'fast.js/array/filter';


export const filter = {
  method: function(filterFn) {
    invariant(
      typeof filterFn === 'function',
      'filter(...): argument must be a function'
    );

    this._addPipeline('filter', filterFn);
    return this;
  },

  process: function(docs, pipeObj) {
    return _filter(docs, pipeObj.value);
  },
};
