'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compileProjection = compileProjection;
exports.checkSupportedProjection = checkSupportedProjection;
exports.projectionDetails = projectionDetails;
exports.pathsToTree = pathsToTree;
exports.combineImportantPathsIntoProjection = combineImportantPathsIntoProjection;
exports.combineMatcherWithProjection = combineMatcherWithProjection;
exports.combineSorterWithProjection = combineSorterWithProjection;

var _checkTypes = require('check-types');

var _checkTypes2 = _interopRequireDefault(_checkTypes);

var _forEach = require('fast.js/forEach');

var _forEach2 = _interopRequireDefault(_forEach);

var _keys2 = require('fast.js/object/keys');

var _keys3 = _interopRequireDefault(_keys2);

var _assign2 = require('fast.js/object/assign');

var _assign3 = _interopRequireDefault(_assign2);

var _every2 = require('fast.js/array/every');

var _every3 = _interopRequireDefault(_every2);

var _filter2 = require('fast.js/array/filter');

var _filter3 = _interopRequireDefault(_filter2);

var _map2 = require('fast.js/map');

var _map3 = _interopRequireDefault(_map2);

var _indexOf2 = require('fast.js/array/indexOf');

var _indexOf3 = _interopRequireDefault(_indexOf2);

var _EJSON = require('./EJSON');

var _EJSON2 = _interopRequireDefault(_EJSON);

var _Document = require('./Document');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Internals
function _has(obj, key) {
  return _checkTypes2.default.object(obj) && obj.hasOwnProperty(key);
}

/**
 * A wrapper around pojection functions.
 */

var DocumentProjector = function () {
  function DocumentProjector(fields) {
    _classCallCheck(this, DocumentProjector);

    this.fields = fields;
    this._projector = compileProjection(fields);
  }

  _createClass(DocumentProjector, [{
    key: 'project',
    value: function project(docs) {
      var _this = this;

      if (_checkTypes2.default.array(docs)) {
        return (0, _map3.default)(docs, function (doc) {
          return _this._projector(doc);
        });
      } else {
        return this._projector(docs);
      }
    }
  }]);

  return DocumentProjector;
}();

// Knows how to compile a fields projection to a predicate function.
// @returns - Function: a closure that filters out an object according to the
//            fields projection rules:
//            @param obj - Object: MongoDB-styled document
//            @returns - Object: a document with the fields filtered out
//                       according to projection rules. Doesn't retain subfields
//                       of passed argument.

exports.default = DocumentProjector;
function compileProjection(fields) {
  checkSupportedProjection(fields);

  var _idProjection = fields._id === undefined ? true : fields._id;
  var details = projectionDetails(fields);

  // returns transformed doc according to ruleTree
  var transform = function transform(doc, ruleTree) {
    // Special case for 'sets'
    if (_checkTypes2.default.array(doc)) {
      return (0, _map3.default)(doc, function (subdoc) {
        return transform(subdoc, ruleTree);
      });
    }

    var res = details.including ? {} : _EJSON2.default.clone(doc);
    (0, _forEach2.default)(ruleTree, function (rule, key) {
      if (!_has(doc, key)) {
        return;
      }
      if (_checkTypes2.default.object(rule)) {
        // For sub-objects/subsets we branch
        if (_checkTypes2.default.object(doc[key]) || _checkTypes2.default.array(doc[key])) {
          res[key] = transform(doc[key], rule);
        }
        // Otherwise we don't even touch this subfield
      } else if (details.including) {
          res[key] = _EJSON2.default.clone(doc[key]);
        } else {
          delete res[key];
        }
    });

    return res;
  };

  return function (obj) {
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
function checkSupportedProjection(fields) {
  if (!_checkTypes2.default.object(fields) || _checkTypes2.default.array(fields)) {
    throw Error('fields option must be an object');
  }

  (0, _forEach2.default)(fields, function (val, keyPath) {
    var valKeys = _checkTypes2.default.object(val) && (0, _keys3.default)(val) || [];
    if ((0, _indexOf3.default)(keyPath.split('.'), '$') >= 0) {
      throw Error('Minimongo doesn\'t support $ operator in projections yet.');
    }
    if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object' && ((0, _indexOf3.default)(valKeys, '$elemMatch') >= 0 || (0, _indexOf3.default)(valKeys, '$meta') >= 0 || (0, _indexOf3.default)(valKeys, '$slice') >= 0)) {
      throw Error('Minimongo doesn\'t support operators in projections yet.');
    }
    if ((0, _indexOf3.default)([1, 0, true, false], val) === -1) {
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
function projectionDetails(fields) {
  // Find the non-_id keys (_id is handled specially because it is included unless
  // explicitly excluded). Sort the keys, so that our code to detect overlaps
  // like 'foo' and 'foo.bar' can assume that 'foo' comes first.
  var fieldsKeys = (0, _keys3.default)(fields).sort();

  // If _id is the only field in the projection, do not remove it, since it is
  // required to determine if this is an exclusion or exclusion. Also keep an
  // inclusive _id, since inclusive _id follows the normal rules about mixing
  // inclusive and exclusive fields. If _id is not the only field in the
  // projection and is exclusive, remove it so it can be handled later by a
  // special case, since exclusive _id is always allowed.
  if (fieldsKeys.length > 0 && !(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !((0, _indexOf3.default)(fieldsKeys, '_id') >= 0 && fields._id)) {
    fieldsKeys = (0, _filter3.default)(fieldsKeys, function (key) {
      return key !== '_id';
    });
  }

  var including = null; // Unknown

  (0, _forEach2.default)(fieldsKeys, function (keyPath) {
    var rule = !!fields[keyPath];
    if (including === null) {
      including = rule;
    }
    if (including !== rule) {
      // This error message is copied from MongoDB shell
      throw Error('You cannot currently mix including and excluding fields.');
    }
  });

  var projectionRulesTree = pathsToTree(fieldsKeys, function (path) {
    return including;
  }, function (node, path, fullPath) {
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
    throw Error('both ' + currentPath + ' and ' + anotherPath + ' found in fields option, using both of them may trigger ' + 'unexpected behavior. Did you mean to use only one of them?');
  });

  return {
    tree: projectionRulesTree,
    including: including
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
function pathsToTree(paths, newLeafFn, conflictFn, tree) {
  tree = tree || {};
  (0, _forEach2.default)(paths, function (keyPath) {
    var treePos = tree;
    var pathArr = keyPath.split('.');

    // use _.all just for iteration with break
    var success = (0, _every3.default)(pathArr.slice(0, -1), function (key, idx) {
      if (!_has(treePos, key)) {
        treePos[key] = {};
      } else if (!_checkTypes2.default.object(treePos[key])) {
        treePos[key] = conflictFn(treePos[key], pathArr.slice(0, idx + 1).join('.'), keyPath);
        // break out of loop if we are failing for this path
        if (!_checkTypes2.default.object(treePos[key])) {
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
function combineImportantPathsIntoProjection(paths, projection) {
  var prjDetails = projectionDetails(projection);
  var tree = prjDetails.tree;
  var mergedProjection = {};

  // merge the paths to include
  tree = pathsToTree(paths, function (path) {
    return true;
  }, function (node, path, fullPath) {
    return true;
  }, tree);
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
    (0, _forEach2.default)(mergedProjection, function (incl, path) {
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
function combineMatcherWithProjection(matcher, projection) {
  var selectorPaths = _pathsElidingNumericKeys(matcher._getPaths());

  // Special case for $where operator in the selector - projection should depend
  // on all fields of the document. getSelectorPaths returns a list of paths
  // selector depends on. If one of the paths is '' (empty string) representing
  // the root or the whole document, complete projection should be returned.
  if ((0, _indexOf3.default)(selectorPaths, '') >= 0) {
    return {};
  }

  return combineImportantPathsIntoProjection(selectorPaths, projection);
}

// Knows how to combine a mongo selector and a fields projection to a new fields
// projection taking into account active fields from the passed selector.
// @returns Object - projection object (same as fields option of mongo cursor)
function combineSorterWithProjection(sorter, projection) {
  var specPaths = _pathsElidingNumericKeys(sorter._getPaths());
  return combineImportantPathsIntoProjection(specPaths, projection);
}

// Internal utils
var _pathsElidingNumericKeys = function _pathsElidingNumericKeys(paths) {
  return (0, _map3.default)(paths, function (path) {
    return (0, _filter3.default)(path.split('.'), function (k) {
      return !(0, _Document.isNumericKey)(k);
    }).join('.');
  });
};

// Returns a set of key paths similar to
// { 'foo.bar': 1, 'a.b.c': 1 }
var treeToPaths = function treeToPaths(tree, prefix) {
  prefix = prefix || '';
  var result = {};

  (0, _forEach2.default)(tree, function (val, key) {
    if (_checkTypes2.default.object(val)) {
      (0, _assign3.default)(result, treeToPaths(val, prefix + key + '.'));
    } else {
      result[prefix + key] = val;
    }
  });

  return result;
};