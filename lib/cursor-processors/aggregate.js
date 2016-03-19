import invariant from 'invariant';


export const aggregate = {
  method: function(aggrFn) {
    invariant(
      typeof aggrFn === 'function',
      'aggregate(...): aggregator must be a function'
    );

    this._addPipeline('aggregate', aggrFn);
    return this;
  },

  process: function(docs, pipeObj) {
    return pipeObj.value(docs);
  },
};
