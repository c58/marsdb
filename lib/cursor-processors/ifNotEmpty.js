import _check from 'check-types';


export const ifNotEmpty = {
  method: function() {
    this._addPipeline('ifNotEmpty');
    return this;
  },

  process: function(docs) {
    const isEmptyRes = (
      !_check.assigned(docs) ||
      (_check.array(docs) && _check.emptyArray(docs)) ||
      (_check.object(docs) && _check.emptyObject(docs))
    );
    return isEmptyRes ? '___[STOP]___' : docs;
  },
};
