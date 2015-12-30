'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Originally based on: https://github.com/internalfx/bplus-index
 * Thanks, @internalfx
 */

// NOT WORKING YET
var Utils = {};
var uniqArray = {};

// Internal utils
function _makeRequestNullSearcheble(val) {
  var result = [];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = val[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var v = _step.value;

      if (v === undefined || v === null) {
        result.push(undefined);
        result.push(null);
      } else {
        result.push(v);
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return result;
}

function _getUniqueKeysArray(keyOrKeys, comparator) {
  var result = undefined;
  if (Utils.isArray(keyOrKeys)) {
    var flatArray = Utils.flattenArray(keyOrKeys, 1);
    result = uniqArray(flatArray, comparator, false);
    if (!result.length) {
      result.push([]);
    }
  } else {
    result = [keyOrKeys];
  }
  return result;
}

function _stepForward(index, leaf) {
  if (index + 1 < leaf.keys.length) {
    return { index: index + 1, leaf: leaf };
  } else if (leaf.next) {
    return { index: 0, leaf: leaf.next };
  } else {
    return null;
  }
}

var Leaf = exports.Leaf = (function () {
  function Leaf() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Leaf);

    this.id = Utils.uniqueId();
    this.parent = null;
    this.prev = null;
    this.next = null;
    this.children = [];
    this.keys = [];
    this.values = [];
    this.comparator = config.comparator;
    this.unique = config.unique;
  }

  _createClass(Leaf, [{
    key: 'insertData',
    value: function insertData(key, val) {
      var location = Utils.binarySearch(this.keys, key, this.comparator);
      if (location.found) {
        if (this.unique) {
          throw new Error('insertData(...): key ' + key + ' already exists in unique index');
        }
        var dataLocation = Utils.binarySearch(this.values[location.index], val, this.comparator);
        Utils.insertAt(this.values[location.index], val, dataLocation.index);
      } else {
        Utils.insertAt(this.keys, key, location.index);
        Utils.insertAt(this.values, [val], location.index);
      }
    }
  }, {
    key: 'deleteData',
    value: function deleteData(key, val) {
      var keyLocation = Utils.binarySearch(this.keys, key, this.comparator);
      if (keyLocation.found) {
        var dataLocation = Utils.binarySearch(this.values[keyLocation.index], val, this.comparator);
        if (dataLocation.found) {
          Utils.removeAt(this.values[keyLocation.index], dataLocation.index);
          if (this.values[keyLocation.index].length === 0) {
            // if this was the last value at this key, delete the key too.
            Utils.removeAt(this.keys, keyLocation.index);
            Utils.removeAt(this.values, keyLocation.index);
          }
        }
      }

      return keyLocation;
    }
  }, {
    key: 'get',
    value: function get(key) {
      var location = Utils.binarySearch(this.keys, key, this.comparator);
      if (location.found) {
        return this.values[location.index];
      } else {
        return [];
      }
    }
  }, {
    key: 'size',
    value: function size() {
      return this.keys.length;
    }
  }, {
    key: 'hasChildren',
    value: function hasChildren() {
      return this.children.length > 0;
    }
  }, {
    key: 'setParentOnChildren',
    value: function setParentOnChildren() {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.children[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var child = _step2.value;

          child.parent = this;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }, {
    key: 'replaceKey',
    value: function replaceKey(key, newKey) {
      var loc = Utils.binarySearch(this.keys, key, this.comparator);

      if (loc.found) {
        if (this.debug) {
          console.log('replace ' + key + ' with ' + newKey + ' in leaf ' + this.id);
        }
        Utils.replaceAt(this.keys, newKey, loc.index);
      }

      if (this.parent) {
        this.parent.replaceKey(key, newKey);
      }
    }
  }, {
    key: 'updateKeys',
    value: function updateKeys() {
      if (this.hasChildren()) {
        var keys = [];
        for (var i = 1; i < this.children.length; i++) {
          var child = this.children[i];
          keys.push(Utils.detectKey(child));
        }
        if (keys.length > 0) {
          this.keys = keys;
        }
      }
    }
  }]);

  return Leaf;
})();

/**
 * BPlusTree implementation, aimed to be an index
 * of MarsDB.
 * May have custom comparator index and trow error
 * on duplicates if unique key presented.
 */

var BPlusTree = exports.BPlusTree = (function () {
  function BPlusTree() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, BPlusTree);

    this.bf = config.branchingFactor || 50;
    this.debug = config.debug || false;
    this.comparator = config.comparator;
    this.unique = config.unique || false;
    this.root = new Leaf({ comparator: this.comparator, unique: this.unique });
  }

  _createClass(BPlusTree, [{
    key: 'dumpTree',
    value: function dumpTree(leaf) {
      leaf = leaf || this.root;
      var struct = {
        id: leaf.id,
        keys: leaf.keys,
        values: leaf.values,
        prev: leaf.prev ? leaf.prev.id : null,
        next: leaf.next ? leaf.next.id : null,
        children: []
      };

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = leaf.children[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var child = _step3.value;

          struct.children.push(this.dumpTree(child));
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return struct;
    }
  }, {
    key: 'search',
    value: function search(keyOrKeys) {
      var _this = this;

      var uniqKeys = _getUniqueKeysArray(keyOrKeys, this.comparator);
      var nullSearcheble = _makeRequestNullSearcheble(uniqKeys);

      var r = Utils.flattenArray(nullSearcheble.map(function (k) {
        var res = _this._findLeaf(k).get(k);
        return res;
      }), 1);
      return r;
    }
  }, {
    key: 'getAll',
    value: function getAll() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var startLeaf = this._findLeaf(Utils.detectKey(this.root));
      var currLoc = { index: 0, leaf: startLeaf };
      var result = [];

      while (currLoc !== null) {
        if (currLoc.leaf.keys.length > 0) {
          (function () {
            var key = currLoc.leaf.keys[currLoc.index];
            var values = currLoc.leaf.values[currLoc.index];

            values.forEach(function (x) {
              result.push({
                key: key,
                value: x
              });
            });
          })();
        }
        currLoc = _stepForward(currLoc.index, currLoc.leaf);
      }

      return options.matcher ? result.filter(options.matcher) : result;
    }
  }, {
    key: 'getNumberOfKeys',
    value: function getNumberOfKeys() {
      return new Set(this.getAll().map(function (x) {
        return x.key;
      })).size;
    }
  }, {
    key: 'getBetweenBounds',
    value: function getBetweenBounds() {
      var query = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var result = [];
      var options = {
        lowerInclusive: false,
        upperInclusive: false
      };
      var lowerBound = -Infinity;
      var upperBound = +Infinity;

      if (query.hasOwnProperty('$gt') || query.hasOwnProperty('$gte')) {
        lowerBound = this.comparator(query.$gte, query.$gt) === -1 ? query.$gt : query.$gte;
        lowerBound = Utils.isNumber(lowerBound) ? lowerBound : -Infinity;
        options.lowerInclusive = query.$gte === lowerBound;
      }

      if (query.hasOwnProperty('$lt') || query.hasOwnProperty('$lte')) {
        upperBound = this.comparator(query.$lte, query.$lt) === -1 ? query.$lt : query.$lte;
        upperBound = Utils.isNumber(upperBound) ? upperBound : +Infinity;
        options.upperInclusive = query.$lte === upperBound;
      }

      var startLeaf = this._findLeaf(lowerBound);
      var loc = Utils.binarySearch(startLeaf.keys, lowerBound, this.comparator);
      var currLoc = { index: loc.index, leaf: startLeaf };

      if (loc.index >= startLeaf.keys.length) {
        currLoc = _stepForward(currLoc.index, currLoc.leaf);
      }

      if (loc.found && options.lowerInclusive === false) {
        currLoc = _stepForward(currLoc.index, currLoc.leaf);
      }

      while (currLoc && currLoc.leaf.keys[currLoc.index] < upperBound) {
        result = result.concat(currLoc.leaf.values[currLoc.index]);
        currLoc = _stepForward(currLoc.index, currLoc.leaf);
      }

      if (currLoc && currLoc.leaf.keys[currLoc.index] <= upperBound && options.upperInclusive === true) {
        result = result.concat(currLoc.leaf.values[currLoc.index]);
      }

      return result;
    }
  }, {
    key: 'insert',
    value: function insert(keyOrKeys, val) {
      var _this2 = this;

      if (this.debug) {
        console.log('INJECT ' + keyOrKeys + ' = ' + val);
      }

      var uniqKeys = _getUniqueKeysArray(keyOrKeys, this.comparator);
      var failingIndex = null;
      try {
        uniqKeys.forEach(function (key, i) {
          failingIndex = i;
          var leaf = _this2._findLeaf(key);
          leaf.insertData(key, val);
          _this2._splitLeaf(leaf);
        });
      } catch (e) {
        this.delete(uniqKeys.slice(0, failingIndex), val);
        throw e;
      }
    }
  }, {
    key: 'delete',
    value: function _delete(keyOrKeys, val) {
      var _this3 = this;

      if (this.debug) {
        console.log('EJECT ' + keyOrKeys + ' = ' + val);
      }

      var uniqKeys = _getUniqueKeysArray(keyOrKeys, this.comparator);
      var failingIndex = null;
      try {
        uniqKeys.forEach(function (key, i) {
          failingIndex = i;
          var leaf = _this3._findLeaf(key);
          var loc = leaf.deleteData(key, val);
          if (loc.found && loc.index === 0 && leaf.parent) {
            if (leaf.keys.length > 0 && key !== leaf.keys[0]) {
              if (_this3.debug) {
                console.log('REPLACE LEAF KEYS ' + key + ' -> ' + leaf.keys[0]);
              }
              leaf.parent.replaceKey(key, leaf.keys[0]);
            }
          }
          _this3._mergeLeaf(leaf);
        });
      } catch (e) {
        this.insert(uniqKeys.slice(0, failingIndex), val);
        throw e;
      }
    }
  }, {
    key: '_minKeys',
    value: function _minKeys() {
      return Math.floor(this.bf / 2);
    }
  }, {
    key: '_maxKeys',
    value: function _maxKeys() {
      return this.bf - 1;
    }

    // Private Methods

  }, {
    key: '_findLeaf',
    value: function _findLeaf(key, leaf) {
      leaf = leaf || this.root;
      if (leaf.children.length === 0) {
        return leaf;
      } else {
        var loc = Utils.binarySearch(leaf.keys, key, this.comparator);
        var index = loc.found ? loc.index + 1 : loc.index;
        return this._findLeaf(key, leaf.children[index]);
      }
    }
  }, {
    key: '_splitLeaf',
    value: function _splitLeaf(leaf) {
      if (leaf.size() > this._maxKeys()) {
        if (this.debug) {
          console.log('BEFORE SPLIT LEAF ' + leaf.id);
          console.log(JSON.stringify(this.dumpTree(), null, 2));
        }
        var splitPoint = Math.floor(leaf.size() / 2);
        var parent = leaf.parent;
        var prev = leaf.prev;
        var next = leaf.next;
        var children = leaf.children;
        var keys = leaf.keys;
        var values = leaf.values;

        // TODO: Optimize: we could re-use one of the leaves

        var leftLeaf = new Leaf({ comparator: this.comparator, unique: this.unique });
        var rightLeaf = new Leaf({ comparator: this.comparator, unique: this.unique });

        if (prev != null) {
          prev.next = leftLeaf;
        }
        if (next != null) {
          next.prev = rightLeaf;
        }

        leftLeaf.parent = parent;
        leftLeaf.children = children.slice(0, splitPoint);
        leftLeaf.keys = keys.slice(0, splitPoint);
        leftLeaf.values = values.slice(0, splitPoint);

        rightLeaf.parent = parent;
        rightLeaf.children = children.slice(splitPoint);
        rightLeaf.keys = keys.slice(splitPoint);
        rightLeaf.values = values.slice(splitPoint);

        // In a B+tree only leaves contain data, everything else is a node

        if (leaf === this.root) {
          // If we are splitting the root
          if (leaf.values.length > 0) {
            // If the root is also a leaf (has data)
            parent = this.root = new Leaf({ comparator: this.comparator, unique: this.unique });
            parent.children = [leftLeaf, rightLeaf];
            parent.keys = [keys[splitPoint]];
            leftLeaf.parent = parent;
            rightLeaf.parent = parent;
            leftLeaf.next = rightLeaf;
            rightLeaf.prev = leftLeaf;
            if (this.debug) {
              console.log('SPLIT ROOT LEAF');
              console.log(JSON.stringify(this.dumpTree(), null, 2));
            }
          } else {
            // If the root is a node)
            parent = this.root = new Leaf({ comparator: this.comparator, unique: this.unique });
            parent.children = [leftLeaf, rightLeaf];
            parent.keys = [keys[splitPoint]];
            leftLeaf.parent = parent;
            leftLeaf.children = children.slice(0, splitPoint + 1);
            leftLeaf.setParentOnChildren();

            rightLeaf.parent = parent;
            rightLeaf.keys = keys.slice(splitPoint + 1);
            rightLeaf.children = children.slice(splitPoint + 1);
            rightLeaf.setParentOnChildren();
            if (this.debug) {
              console.log('SPLIT ROOT NODE');
              console.log(JSON.stringify(this.dumpTree(), null, 2));
            }
          }
        } else {
          // If we are not splitting root

          var childPos = parent.children.indexOf(leaf);

          if (leaf.values.length > 0) {
            // If we are splitting a leaf

            if (childPos !== 0) {
              Utils.replaceAt(parent.keys, leftLeaf.keys[0], childPos - 1);
            }
            Utils.replaceAt(parent.children, leftLeaf, childPos);
            Utils.insertAt(parent.keys, rightLeaf.keys[0], childPos);
            Utils.insertAt(parent.children, rightLeaf, childPos + 1);

            leftLeaf.prev = leaf.prev;
            leftLeaf.next = rightLeaf;
            rightLeaf.prev = leftLeaf;
            rightLeaf.next = leaf.next;

            if (this.debug) {
              console.log('SPLIT BRANCH LEAF');
              console.log(JSON.stringify(this.dumpTree(), null, 2));
            }
            this._splitLeaf(parent);
          } else {
            // If we are splitting a node

            rightLeaf.keys = keys.slice(splitPoint + 1);
            leftLeaf.children = children.slice(0, splitPoint + 1);
            leftLeaf.setParentOnChildren();
            rightLeaf.children = children.slice(splitPoint + 1);
            rightLeaf.setParentOnChildren();
            Utils.replaceAt(parent.children, leftLeaf, childPos);
            Utils.insertAt(parent.keys, keys[splitPoint], childPos);
            Utils.insertAt(parent.children, rightLeaf, childPos + 1);
            if (this.debug) {
              console.log('SPLIT BRANCH NODE');
              console.log(JSON.stringify(this.dumpTree(), null, 2));
            }
            this._splitLeaf(parent);
          }
        }
      }
    }
  }, {
    key: '_mergeLeaf',
    value: function _mergeLeaf(leaf) {
      if (leaf.hasChildren()) {
        if (leaf.children.length > this._minKeys()) {
          if (leaf.children.length > leaf.keys.length) {
            return; // Doesn't need to merge
          }
        }
      } else {
          if (leaf.size() >= this._minKeys()) {
            return; // Doesn't need to merge
          }
        }

      if (this.debug) {
        console.log('BEFORE MERGE LEAF ' + leaf.id);
        console.log(JSON.stringify(this.dumpTree(), null, 2));
      }

      if (leaf === this.root) {
        // If we are merging the root
        if (leaf.children.length === 1) {
          leaf.children[0].parent = null;
          this.root = leaf.children[0];
          this.root.updateKeys();

          leaf.children = null;
        } else {
          leaf.updateKeys();
          leaf.setParentOnChildren();
        }
      } else {
        // Check Siblings
        var childPos = leaf.parent.children.indexOf(leaf);
        var leftSibling = null;
        var rightSibling = null;

        if (childPos > 0) {
          leftSibling = leaf.parent.children[childPos - 1];
        }

        if (childPos < leaf.parent.children.length - 1) {
          rightSibling = leaf.parent.children[childPos + 1];
        }

        if (leaf.children.length > 0) {
          // If we are merging a branch

          // Try to get a key from a sibling if they are big enough
          if (leftSibling && leftSibling.size() > this._minKeys()) {
            // Check the left sibling

            leaf.keys.unshift(leftSibling.keys.pop());
            leaf.children.unshift(leftSibling.children.pop());
            Utils.replaceAt(leaf.parent.keys, leaf.keys[0], childPos - 1);
            leaf.updateKeys();
            leaf.setParentOnChildren();
            leftSibling.updateKeys();
            leftSibling.setParentOnChildren();

            leaf.parent.updateKeys();
          } else if (rightSibling && rightSibling.size() > this._minKeys()) {
            // Check the right sibling

            leaf.keys.push(rightSibling.keys.shift());
            leaf.children.push(rightSibling.children.shift());
            Utils.replaceAt(leaf.parent.keys, rightSibling.keys[0], leaf.parent.children.indexOf(rightSibling) - 1);
            leaf.updateKeys();
            leaf.setParentOnChildren();
            rightSibling.updateKeys();
            rightSibling.setParentOnChildren();

            leaf.parent.updateKeys();
          } else {
            if (leftSibling) {
              // Copy remaining keys and children to a sibling
              leftSibling.keys = leftSibling.keys.concat(leaf.keys);
              leftSibling.children = leftSibling.children.concat(leaf.children);
              leftSibling.updateKeys();
              leftSibling.setParentOnChildren();
            } else {
              rightSibling.keys = leaf.keys.concat(rightSibling.keys);
              rightSibling.children = leaf.children.concat(rightSibling.children);
              rightSibling.updateKeys();
              rightSibling.setParentOnChildren();
            }

            // Empty Leaf
            leaf.keys = [];
            leaf.children = [];

            // Remove leaf from parent
            Utils.removeAt(leaf.parent.children, childPos);

            // Update keys on parent branch
            leaf.parent.updateKeys();
          }

          if (this.debug) {
            console.log('MERGE BRANCH NODE');
            console.log(JSON.stringify(this.dumpTree(), null, 2));
          }

          this._mergeLeaf(leaf.parent);
        } else {
          // If we are merging a leaf

          // Try to get a key from a sibling if they are big enough
          if (leftSibling && leftSibling.size() > this._minKeys()) {
            // Check the left sibling

            leaf.keys.unshift(leftSibling.keys.pop());
            leaf.values.unshift(leftSibling.values.pop());
            Utils.replaceAt(leaf.parent.keys, leaf.keys[0], childPos - 1);
          } else if (rightSibling && rightSibling.size() > this._minKeys()) {
            // Check the right sibling

            leaf.keys.push(rightSibling.keys.shift());
            leaf.values.push(rightSibling.values.shift());
            Utils.replaceAt(leaf.parent.keys, rightSibling.keys[0], leaf.parent.children.indexOf(rightSibling) - 1);
          } else {
            // There is no sibling to get a value from, remove the leaf

            if (leftSibling) {
              // Copy remaining keys and values to a sibling
              leftSibling.keys = leftSibling.keys.concat(leaf.keys);
              leftSibling.values = leftSibling.values.concat(leaf.values);
            } else {
              rightSibling.keys = leaf.keys.concat(rightSibling.keys);
              rightSibling.values = leaf.values.concat(rightSibling.values);
            }

            if (leaf.prev) {
              leaf.prev.next = leaf.next;
            }
            if (leaf.next) {
              leaf.next.prev = leaf.prev;
            }

            // Empty Leaf
            leaf.keys = [];
            leaf.values = [];

            // Remove leaf from parent
            Utils.removeAt(leaf.parent.children, childPos);

            // // Update keys on parent branch
            leaf.parent.updateKeys();
          }

          if (this.debug) {
            console.log('MERGE BRANCH LEAF');
            console.log(JSON.stringify(this.dumpTree(), null, 2));
          }

          this._mergeLeaf(leaf.parent);
        }
      }
    }
  }]);

  return BPlusTree;
})();

exports.default = BPlusTree;