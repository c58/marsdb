import invariant from 'invariant';


module.exports = {
  'sortFunc': {
    method: function(sortFn) {
      invariant(
        typeof sortFn === 'function',
        'sortFunc(...): argument must be a function'
      );

      this._addPipeline('sortFunc', sortFn);
      return this;
    },

    process: function(docs, pipeObj) {
      return docs.sort(pipeObj.value);
    },
  },
};
