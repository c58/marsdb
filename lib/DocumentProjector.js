import _check from 'check-types';
import _each from 'fast.js/forEach';
import _keys from 'fast.js/object/keys';
import _assign from 'fast.js/object/assign';
import _every from 'fast.js/array/every';
import _filter from 'fast.js/array/filter';
import _map from 'fast.js/map';
import _indexOf from 'fast.js/array/indexOf';
import EJSON from './EJSON';
import { isNumericKey } from './Document';


// Internals
function _has(obj, key) {
  return _check.object(obj) && obj.hasOwnProperty(key);
}


/**
 * A wrapper around pojection functions.
 */
export default class DocumentProjector {
  constructor(fields) {
    this.fields = fields;
    this._projector = compileProjection(fields);
  }

  project(docs) {
    if (_check.array(docs)) {
      return _map(docs, (doc) => this._projector(doc));
    } else {
      return this._projector(docs);
    }
  }
}


// Knows how to compile a fields projection to a predicate function.
// @returns - Function: a closure that filters out an object according to the
//            fields projection rules:
//            @param obj - Object: MongoDB-styled document
//            @returns - Object: a document with the fields filtered out
//                       according to projection rules. Doesn't retain subfields
//                       of passed argument.
export function compileProjection(fields) {
  checkSupportedProjection(fields);

  var _idProjection = fields._id === undefined ? true : fields._id;
  var details = projectionDetails(fields);

  // returns transformed doc according to ruleTree
  var transform = (doc, ruleTree) => {
    // Special case for 'sets'
    if (_check.array(doc)) {
      return _map(doc, (subdoc) => transform(subdoc, ruleTree));
    }

    var res = details.including ? {} : EJSON.clone(doc);
    _each(ruleTree, (rule, key) => {
      if (!_has(doc, key)) {
        return;
      }
      if (_check.object(rule)) {
        // For sub-objects/subsets we branch
        if (_check.object(doc[key]) || _check.array(doc[key])) {
          res[key] = transform(doc[key], rule);
        }
        // Otherwise we don't even touch this subfield
      } else if (details.including) {
        res[key] = EJSON.clone(doc[key]);
      } else {
        delete res[key];
      }
    });

    return res;
  };

  return (obj) => {
    var res = transform(obj, details.tree);
    if (_idProjection && _has(obj, '_id')) {
      res._id = obj._id;
    }
    if (!_idProjection && _has(res, '_id')) {
      delete res._id;
    }
    return res;
  };
}


// Rise an exception if fields object contains
// some unsupported fields or values
export function checkSupportedProjection(fields) {
  if (!_check.object(fields) || _check.array(fields)) {
    throw Error('fields option must be an object');
  }

  _each(fields, (val, keyPath) => {
    const valKeys = (_check.object(val) && _keys(val)) || [];
    if (_indexOf(keyPath.split('.'), '$') >= 0) {
      throw Error('Minimongo doesn\'t support $ operator in projections yet.');
    }
    if (typeof val === 'object' && (
        _indexOf(valKeys, '$elemMatch') >= 0 ||
        _indexOf(valKeys, '$meta') >= 0 ||
        _indexOf(valKeys, '$slice') >= 0
        )
    ) {
      throw Error('Minimongo doesn\'t support operators in projections yet.');
    }
    if (_indexOf([1, 0, true, false], val) === -1) {
      throw Error('Projection values should be one of 1, 0, true, or false');
    }
  });
}


// Traverses the keys of passed projection and constructs a tree where all
// leaves are either all True or all False
// @returns Object:
//  - tree - Object - tree representation of keys involved in projection
//  (exception for '_id' as it is a special case handled separately)
//  - including - Boolean - 'take only certain fields' type of projection
export function projectionDetails(fields) {
  // Find the non-_id keys (_id is handled specially because it is included unless
  // explicitly excluded). Sort the keys, so that our code to detect overlaps
  // like 'foo' and 'foo.bar' can assume that 'foo' comes first.
  var fieldsKeys = _keys(fields).sort();

  // If _id is the only field in the projection, do not remove it, since it is
  // required to determine if this is an exclusion or exclusion. Also keep an
  // inclusive _id, since inclusive _id follows the normal rules about mixing
  // inclusive and exclusive fields. If _id is not the only field in the
  // projection and is exclusive, remove it so it can be handled later by a
  // special case, since exclusive _id is always allowed.
  if (
    fieldsKeys.length > 0 &&
    !(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') &&
    !(_indexOf(fieldsKeys, '_id') >= 0 && fields._id)
  ) {
    fieldsKeys = _filter(fieldsKeys, (key) => key !== '_id');
  }

  var including = null; // Unknown

  _each(fieldsKeys, (keyPath) => {
    var rule = !!fields[keyPath];
    if (including === null) {
      including = rule;
    }
    if (including !== rule) {
      // This error message is copied from MongoDB shell
      throw Error('You cannot currently mix including and excluding fields.');
    }
  });

  var projectionRulesTree = pathsToTree(
    fieldsKeys,
    (path) => including,
    (node, path, fullPath) => {
      // Check passed projection fields' keys: If you have two rules such as
      // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
      // that happens, there is a probability you are doing something wrong,
      // framework should notify you about such mistake earlier on cursor
      // compilation step than later during runtime.  Note, that real mongo
      // doesn't do anything about it and the later rule appears in projection
      // project, more priority it takes.
      //
      // Example, assume following in mongo shell:
      // > db.coll.insert({ a: { b: 23, c: 44 } })
      // > db.coll.find({}, { 'a': 1, 'a.b': 1 })
      // { '_id' : ObjectId('520bfe456024608e8ef24af3'), 'a' : { 'b' : 23 } }
      // > db.coll.find({}, { 'a.b': 1, 'a': 1 })
      // { '_id' : ObjectId('520bfe456024608e8ef24af3'), 'a' : { 'b' : 23, 'c' : 44 } }
      //
      // Note, how second time the return set of keys is different.

      var currentPath = fullPath;
      var anotherPath = path;
      throw Error('both ' + currentPath + ' and ' + anotherPath +
                  ' found in fields option, using both of them may trigger ' +
                  'unexpected behavior. Did you mean to use only one of them?');
    });

  return {
    tree: projectionRulesTree,
    including: including,
  };
}


// paths - Array: list of mongo style paths
// newLeafFn - Function: of form function(path) should return a scalar value to
//                       put into list created for that path
// conflictFn - Function: of form function(node, path, fullPath) is called
//                        when building a tree path for 'fullPath' node on
//                        'path' was already a leaf with a value. Must return a
//                        conflict resolution.
// initial tree - Optional Object: starting tree.
// @returns - Object: tree represented as a set of nested objects
export function pathsToTree(paths, newLeafFn, conflictFn, tree) {
  tree = tree || {};
  _each(paths, (keyPath) => {
    var treePos = tree;
    var pathArr = keyPath.split('.');

    // use _.all just for iteration with break
    var success = _every(pathArr.slice(0, -1), (key, idx) => {
      if (!_has(treePos, key)) {
        treePos[key] = {};
      } else if (!_check.object(treePos[key])) {
        treePos[key] = conflictFn(
          treePos[key],
          pathArr.slice(0, idx + 1).join('.'),
          keyPath
        );
        // break out of loop if we are failing for this path
        if (!_check.object(treePos[key])) {
          return false;
        }
      }

      treePos = treePos[key];
      return true;
    });

    if (success) {
      var lastKey = pathArr[pathArr.length - 1];
      if (!_has(treePos, lastKey)) {
        treePos[lastKey] = newLeafFn(keyPath);
      } else {
        treePos[lastKey] = conflictFn(treePos[lastKey], keyPath, keyPath);
      }
    }
  });

  return tree;
}


// By given paths array and projection object returns
// new projection object combined with paths.
export function combineImportantPathsIntoProjection(paths, projection) {
  var prjDetails = projectionDetails(projection);
  var tree = prjDetails.tree;
  var mergedProjection = {};

  // merge the paths to include
  tree = pathsToTree(
    paths,
    (path) => true,
    (node, path, fullPath) => true,
    tree
  );
  mergedProjection = treeToPaths(tree);
  if (prjDetails.including) {
    // both selector and projection are pointing on fields to include
    // so we can just return the merged tree
    return mergedProjection;
  } else {
    // selector is pointing at fields to include
    // projection is pointing at fields to exclude
    // make sure we don't exclude important paths
    var mergedExclProjection = {};
    _each(mergedProjection, (incl, path) => {
      if (!incl) {
        mergedExclProjection[path] = false;
      }
    });

    return mergedExclProjection;
  }
}

// Knows how to combine a mongo selector and a fields projection to a new fields
// projection taking into account active fields from the passed selector.
// @returns Object - projection object (same as fields option of mongo cursor)
export function combineMatcherWithProjection(matcher, projection) {
  var selectorPaths = _pathsElidingNumericKeys(matcher._getPaths());

  // Special case for $where operator in the selector - projection should depend
  // on all fields of the document. getSelectorPaths returns a list of paths
  // selector depends on. If one of the paths is '' (empty string) representing
  // the root or the whole document, complete projection should be returned.
  if (_indexOf(selectorPaths, '') >= 0) {
    return {};
  }

  return combineImportantPathsIntoProjection(selectorPaths, projection);
}

// Knows how to combine a mongo selector and a fields projection to a new fields
// projection taking into account active fields from the passed selector.
// @returns Object - projection object (same as fields option of mongo cursor)
export function combineSorterWithProjection(sorter, projection) {
  var specPaths = _pathsElidingNumericKeys(sorter._getPaths());
  return combineImportantPathsIntoProjection(specPaths, projection);
}


// Internal utils
const _pathsElidingNumericKeys = (paths) => {
  return _map(paths, (path) =>
    _filter(path.split('.'), (k) => !isNumericKey(k)).join('.')
  );
};

// Returns a set of key paths similar to
// { 'foo.bar': 1, 'a.b.c': 1 }
const treeToPaths = (tree, prefix) => {
  prefix = prefix || '';
  var result = {};

  _each(tree, (val, key) => {
    if (_check.object(val)) {
      _assign(result, treeToPaths(val, prefix + key + '.'));
    } else {
      result[prefix + key] = val;
    }
  });

  return result;
};
