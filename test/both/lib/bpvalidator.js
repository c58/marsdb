
var validator = {

  getChildRanges: (node, parentRange) => {
    var ranges = []

    for (let i = 0; i <= node.keys.length; i++) {
      let range = []

      if (i === 0) {
        range = [null, node.keys[i]]
      } else if (i === (node.keys.length)) {
        range = [node.keys[i - 1], null]
      } else {
        range = [node.keys[i - 1], node.keys[i]]
      }

      if (parentRange) {
        if (parentRange[0] > range[0]) {
          range[0] = parentRange[0]
        }
        if (parentRange[1] < range[1]) {
          range[1] = parentRange[1]
        }
      }

      ranges.push(range)
    }
    return ranges
  },

  levelView: (level) => {
    var text = ''
    for (let i = 0; i < level; i++) {
      text += '--'
    }
    return text
  },

  validateNode: (tree, node=null, checks={}) => {
    var level = checks.level || 1
    node = node || tree.root
    var errors = []
    var childRanges = validator.getChildRanges(node, checks.range)
    var minNodeKeys = Math.floor(tree.bf / 2) - 1
    var minChildren = Math.floor(tree.bf / 2)
    var maxNodeKeys = tree.bf - 1
    var maxChildren = tree.bf
    var nodeType = node.hasChildren() ? 'node' : 'leaf'
    var isRoot = node === tree.root

    // B-tree docs from http://www.cburch.com/cs/340/reading/btree/index.html

    // A B+-tree maintains the following invariants:

    // Every node has one more references than it has keys.
    // All leaves are at the same distance from the root.
    // For every non-leaf node N with k being the number of keys in N: all keys in the first child's subtree are less than N's first key; and all keys in the ith child's subtree (2 ≤ i ≤ k) are between the (i − 1)th key of n and the ith key of n.
    // The root has at least two children.
    // Every non-leaf, non-root node has at least floor(d / 2) children.
    // Each leaf contains at least floor(d / 2) keys.
    // Every key from the table appears in a leaf, in left-to-right sorted order.

    // Every node has one more references than it has keys.
    if (nodeType === 'node') {
      if ((node.keys.length + 1) !== node.children.length) {
        errors.push(`${validator.levelView(level)} ${node.id} wrong number of references! - keys=${node.keys.length}, children=${node.children.length}`)
      }
    }

    if (isRoot) { // The root has at least two children.
      if (node.values.length === 0) {
        if (node.children.length === 1) {
          errors.push(`${validator.levelView(level)} ${node.id} root must have at least 2 children!`)
        }
      }
      if (node.keys.length > maxNodeKeys) {
        errors.push(`${validator.levelView(level)} ${node.id} has too many keys! - should have no more than ${maxNodeKeys} (has ${node.keys.length})`)
      }
    } else { // Check for correct number of keys
      if (node.keys.length > maxNodeKeys) {
        errors.push(`${validator.levelView(level)} ${node.id} has too many keys! - should have no more than ${maxNodeKeys} (has ${node.keys.length})`)
      }
      if (node.keys.length < minNodeKeys) {
        errors.push(`${validator.levelView(level)} ${node.id} has too few keys! - should have no less than ${minNodeKeys} (has ${node.keys.length})`)
      }
    }

    // Every non-leaf, non-root node has at least floor(branchingFactor / 2) children.
    if (isRoot === false && nodeType === 'node') {
      if (node.next !== null) { // nodes dont have references to siblings
        errors.push(`${validator.levelView(level)} ${node.id} should not have a next node`)
      }
      if (node.prev !== null) {
        errors.push(`${validator.levelView(level)} ${node.id} should not have a prev node`)
      }
      if (node.children.length < minChildren) {
        errors.push(`${validator.levelView(level)} ${node.id} has too few children! - (has ${node.keys.length} keys, and ${node.children.length} children)`)
      }
      if (node.children.length > maxChildren) { // and at most (branchingFactor) children
        errors.push(`${validator.levelView(level)} ${node.id} has too many children! - (has ${node.keys.length} keys, and ${node.children.length} children)`)
      }
    }

    // Each leaf contains at least floor(branchingFactor / 2) keys, and values.
    if (isRoot === false && nodeType === 'leaf') {
      if (node.keys.length < minChildren) {
        errors.push(`${validator.levelView(level)} ${node.id} has too few keys! - (has ${node.keys.length} keys, and ${node.values.length} values)`)
      }
      if (node.values.length < minChildren) {
        errors.push(`${validator.levelView(level)} ${node.id} has too few values! - (has ${node.keys.length} keys, and ${node.values.length} values)`)
      }
      if (node.keys.length > maxChildren) {
        errors.push(`${validator.levelView(level)} ${node.id} has too many keys! - (has ${node.keys.length} keys, and ${node.values.length} values)`)
      }
      if (node.values.length > maxChildren) {
        errors.push(`${validator.levelView(level)} ${node.id} has too many values! - (has ${node.keys.length} keys, and ${node.values.length} values)`)
      }
    }

    // Validate parent child relationship
    if (checks.parent) {
      if (node.parent !== checks.parent) {
        errors.push(`${validator.levelView(level)} ${node.id} has invalid parent! - should be child of ${checks.parent.id}`)
      }
    }

    // For every non-leaf node N with k being the number of keys in N: all keys in the first child's subtree are less than N's first key; and all keys in the ith child's subtree (2 ≤ i ≤ k) are between the (i − 1)th key of n and the ith key of n.
    if (checks.range) {
      for (let key of node.keys) {
        if (checks.range[0] !== null) {
          if ((key >= checks.range[0]) === false) {
            errors.push(`${validator.levelView(level)} ${node.id} has invalid key! - ${key} should be >= ${checks.range[0]}`)
          }
        }
        if (checks.range[1] !== null) {
          if ((key < checks.range[1]) === false) {
            errors.push(`${validator.levelView(level)} ${node.id} has invalid key! - ${key} should be < ${checks.range[1]}`)
          }
        }
      }
    }

    // Every key from the table appears in a leaf, in left-to-right sorted order.
    if (isRoot) {
      var currNode = node
      var maxLoop = 10000
      var loop = 1
      var currKey = null

      // Descend to first leaf
      while (currNode.children.length > 0 && loop < maxLoop) {
        currNode = currNode.children[0]
        loop++
      }

      if (currNode.prev !== null) {
        errors.push(`${validator.levelView(level)} ${node.id} leftmost node should have no previous node!`)
      }

      // Traverse entire array of keys
      loop = 1
      while (currNode.next && loop < maxLoop) {

        for (let i = 0; i < currNode.keys.length; i++) {
          if (currKey !== null) {
            if (currKey >= currNode.keys[i]) {
              errors.push(`${validator.levelView(level)} ${node.id} Keys are not in sorted order!`)
            }
          }
          currKey = currNode.keys[i]
        }

        currNode = currNode.next
        loop++
      }

      if (currNode.next !== null) {
        errors.push(`${validator.levelView(level)} ${node.id} rightmost node should have no next node!`)
      }

    }

    // Validate all children
    for (let i = 0; i < node.children.length; i++) {
      errors = errors.concat(validator.validateNode(tree, node.children[i], {parent: node, range: childRanges[i], level: level + 1}))
    }

    return errors
  }

}

module.exports = (tree) => {
  return validator.validateNode(tree)
}
