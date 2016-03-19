import _map from 'fast.js/map';
import invariant from 'invariant';


export const map = {
  method: function(mapperFn) {
    invariant(
      typeof mapperFn === 'function',
      'map(...): mapper must be a function'
    );

    this._addPipeline('map', mapperFn);
    return this;
  },

  process: function(docs, pipeObj) {
    return _map(docs, pipeObj.value);
  },
};
