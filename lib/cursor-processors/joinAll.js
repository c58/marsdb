import _check from 'check-types';
import _map from 'fast.js/map';
import _bind from 'fast.js/function/bind';
import invariant from 'invariant';


export const joinAll = {
  method: function(joinFn) {
    invariant(
      typeof joinFn === 'function',
      'joinAll(...): argument must be a function'
    );

    this._addPipeline('joinAll', joinFn);
    return this;
  },

  process: function(docs, pipeObj, cursor, i = 0, len = 1) {
    const updatedFn = (cursor._propagateUpdate)
      ? _bind(cursor._propagateUpdate, cursor)
      : function() {};

    let res = pipeObj.value(docs, updatedFn, i, len);
    res = _check.array(res) ? res : [res];
    res = _map(res, val => {
      let cursorPromise;
      if (val && val.joinAll) { // instanceof Cursor
        cursorPromise = val.exec();
      } else if (_check.object(val) && val.cursor && val.then) {
        cursorPromise = val;
      }
      if (cursorPromise) {
        cursor._trackChildCursorPromise(cursorPromise);
      }
      return cursorPromise || val;
    });

    return Promise.all(res).then(() => docs);
  },
};
