import _check from 'check-types';
import _each from 'fast.js/forEach';
import _map from 'fast.js/map';
import _filter from 'fast.js/array/filter';
import _reduce from 'fast.js/array/reduce';
import _keys from 'fast.js/object/keys';
import invariant from 'invariant';
import { joinAll } from './joinAll';
import { findModTarget } from '../DocumentModifier';
import { makeLookupFunction } from '../DocumentMatcher';
import { selectorIsId } from '../Document';


module.exports = {
  'joinObj': {
    method: function(obj, options = {}) {
      invariant(
        _check.object(obj),
        'joinObj(...): argument must be an object'
      );

      this._addPipeline('joinObj', obj, options);
      return this;
    },

    process: function(docs, pipeObj, cursor) {
      const joinObj = pipeObj.value;
      const options = pipeObj.args[0] || {};
      const isObj = !_check.array(docs);
      docs = !isObj ? docs : [docs];

      const joinerFn = (dcs) => _map(_keys(joinObj), k => {
        const joinKey = k.split('.')[0];
        const model = joinObj[k];
        const lookupFn = makeLookupFunction(k);
        const childToRootMap = {};
        const docsById = {};
        let allIds = [];

        _each(dcs, (d) => {
          docsById[d._id] = { d, isArray: false };

          const val = lookupFn(d);
          let singleJoin = !val[0] || !val[0].arrayIndices;
          const joinIds = _filter(_reduce(_map(val, x => x.value), (a, b) => {
            if (_check.array(b)) {
              singleJoin = false;
              return [...a, ...b];
            } else {
              return [...a, b];
            }
          }, []), x => selectorIsId(x));

          allIds = allIds.concat(joinIds);
          docsById[d._id].isArray = !singleJoin;
          d[joinKey] = singleJoin ? null : [];

          _each(joinIds, joinId => {
            const localIdsMap = childToRootMap[joinId] || [];
            localIdsMap.push(d._id);
            childToRootMap[joinId] = localIdsMap;
          });
        });

        const execFnName = options.observe ? 'observe' : 'then';
        return model.find({_id: {$in: allIds}})[execFnName](res => {
          _each(res, objToJoin => {
            const docIdsForJoin = childToRootMap[objToJoin._id];
            _each(docIdsForJoin, docId => {
              const doc = docsById[docId];
              if (doc) {
                if (doc.isArray) {
                  doc.d[joinKey].push(objToJoin);
                } else {
                  doc.d[joinKey] = objToJoin;
                }
              }
            });
          });
        });
      });

      const newPipeObj = { ...pipeObj, value: joinerFn };
      return joinAll
        .process(docs, newPipeObj, cursor)
        .then(res => isObj ? res[0] : res);
    },
  },
};
