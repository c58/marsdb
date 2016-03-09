import _check from 'check-types';
import invariant from 'invariant';
import { joinObj } from './joinObj';
import { joinEach } from './joinEach';
import { joinAll } from './joinAll';


export const join = {
  method: function(joinFn, options = {}) {
    invariant(
      typeof joinFn === 'function' || _check.object(joinFn),
      'join(...): argument must be a function'
    );

    this._addPipeline('join', joinFn, options);
    return this;
  },

  process: function(docs, pipeObj, cursor) {
    if (_check.object(pipeObj.value)) {
      return joinObj.process(docs, pipeObj, cursor);
    } else if (_check.array(docs)) {
      return joinEach.process(docs, pipeObj, cursor);
    } else {
      return joinAll.process(docs, pipeObj, cursor);
    }
  },
};
