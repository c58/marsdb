import _check from 'check-types';
import _each from 'fast.js/forEach';
import _map from 'fast.js/map';
import _filter from 'fast.js/array/filter';
import _reduce from 'fast.js/array/reduce';
import _keys from 'fast.js/object/keys';
import Collection from '../Collection';
import invariant from 'invariant';
import { joinAll } from './joinAll';
import { findModTarget } from '../DocumentModifier';
import { makeLookupFunction } from '../DocumentMatcher';
import { selectorIsId } from '../Document';


/**
 * By given list of documents make mapping of joined
 * model ids to root document and vise versa.
 * @param  {Array}  docs
 * @param  {String} key
 * @return {Object}
 */
function _decomposeDocuments(docs, key) {
  const lookupFn = makeLookupFunction(key);
  let allIds = [];

  const docsWrapped = _map(docs, (d) => {
    const val = lookupFn(d);
    const joinIds = _filter(_reduce(_map(val, x => x.value), (a, b) => {
      if (_check.array(b)) {
        return [...a, ...b];
      } else {
        return [...a, b];
      }
    }, []), x => selectorIsId(x));

    allIds = allIds.concat(joinIds);
    return {
      doc: d,
      lookupResult: val,
    };
  });

  return { allIds, docsWrapped };
}


/**
 * By given value of some key in join object return
 * an options object.
 * @param  {Object|Collection} joinValue
 * @return {Object}
 */
function _getJoinOptions(key, value) {
  if (value instanceof Collection) {
    return { model: value, joinPath: key };
  } else if (_check.object(value)) {
    return {
      model: value.model,
      joinPath: value.joinPath || key,
    };
  } else {
    throw new Error('Invalid join object value');
  }
}


/**
 * By given result of joining objects restriving and root documents
 * decomposition set joining object on each root document
 * (if it is exists).
 * @param  {String} joinPath
 * @param  {Array}  res
 * @param  {Object} docsById
 * @param  {Object} childToRootMap
 */
function _joinDocsWithResult(joinPath, res, docsWrapped) {
  const resIdMap = {};
  const initKeyparts = joinPath.split('.');

  _each(res, v => resIdMap[v._id] = v);
  _each(docsWrapped, wrap => {
    _each(wrap.lookupResult, branch => {
      if (branch.value) {
        // `findModTarget` will modify `keyparts`. So, it should
        // be copied each time.
        const keyparts = initKeyparts.slice();
        const target = findModTarget(wrap.doc, keyparts, {
          noCreate: false,
          forbidArray: false,
          arrayIndices: branch.arrayIndices,
        });
        const field = keyparts[keyparts.length - 1];

        if (_check.array(branch.value)) {
          target[field] = _map(branch.value, id => resIdMap[id]);
        } else {
          target[field] = resIdMap[branch.value] || null;
        }
      }
    });
  });
}


export const joinObj = {
  method: function(obj, options = {}) {
    invariant(
      _check.object(obj),
      'joinObj(...): argument must be an object'
    );

    this._addPipeline('joinObj', obj, options);
    return this;
  },

  process: function(docs, pipeObj, cursor) {
    if (!docs) {
      return Promise.resolve(docs);
    } else {
      const obj = pipeObj.value;
      const options = pipeObj.args[0] || {};
      const isObj = !_check.array(docs);
      docs = !isObj ? docs : [docs];

      const joinerFn = (dcs) => _map(_keys(obj), k => {
        const { model, joinPath } = _getJoinOptions(k, obj[k]);
        const { allIds, docsWrapped } = _decomposeDocuments(docs, k);

        const execFnName = options.observe ? 'observe' : 'then';
        return model.find({_id: {$in: allIds}})[execFnName](res => {
          _joinDocsWithResult(joinPath, res, docsWrapped);
        });
      });

      const newPipeObj = { ...pipeObj, value: joinerFn };
      return joinAll
        .process(docs, newPipeObj, cursor)
        .then(res => isObj ? res[0] : res);
    }
  },
};
