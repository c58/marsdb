import _check from 'check-types';
import _map from 'fast.js/map';
import invariant from 'invariant';
import { joinAll } from './joinAll';


export const joinEach = {
  method: function(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinEach(...): argument must be a function'
    );

    this._addPipeline('joinEach', joinFn);
    return this;
  },

  process: function(docs, pipeObj, cursor) {
    if (!docs) {
      return Promise.resolve(docs);
    } else {
      docs = _check.array(docs) ? docs : [docs];
      const docsLength = docs.length;
      return Promise.all(_map(docs, (x, i) =>
        joinAll.process(x, pipeObj, cursor, i, docsLength)
      ));
    }
  },
};
