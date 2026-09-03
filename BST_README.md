# Binary Search Tree (BST) Implementation

A complete implementation of a Binary Search Tree data structure in TypeScript.

## Overview

A Binary Search Tree (BST) is a hierarchical data structure where each node has at most two children: a left child and a right child. It maintains a specific ordering property that makes searching, insertion, and deletion efficient.

## Key Properties

- **Ordering**: For any given node, all nodes in its left subtree have values less than the node's value, and all nodes in its right subtree have values greater than the node's value.
- **No Duplicates**: This implementation does not allow duplicate values.
- **Generic**: Supports any comparable type (numbers, strings, etc.)

## Time Complexities

### Average Case

- **Search**: O(log n)
- **Insert**: O(log n)
- **Delete**: O(log n)
- **Traversal**: O(n)

### Worst Case (Unbalanced Tree)

- All operations: O(n)

## Usage

### Import

```typescript
import { BinarySearchTree } from "./src/binary-search-tree";
```

### Creating a BST

```typescript
// Create a BST with numbers
const bst = new BinarySearchTree<number>();

// Create a BST with strings
const stringBst = new BinarySearchTree<string>();
```

### Inserting Values

```typescript
bst.insert(8);
bst.insert(3);
bst.insert(10);
bst.insert(1);
bst.insert(6);
bst.insert(14);
bst.insert(4);
bst.insert(7);
bst.insert(13);
```

This creates the following tree structure:

```
       8
      / \
     3   10
    / \    \
   1   6    14
      / \   /
     4   7 13
```

### Searching for Values

```typescript
const exists = bst.search(6); // returns true
const missing = bst.search(5); // returns false
```

### Deleting Values

The delete operation handles three cases:

1. Deleting a leaf node (no children)
2. Deleting a node with one child
3. Deleting a node with two children

```typescript
bst.delete(1); // Delete leaf node
bst.delete(10); // Delete node with children
```

### Traversal Methods

#### In-Order Traversal (Left-Root-Right)

Returns values in sorted order:

```typescript
const sorted = bst.inOrderTraversal();
// Returns: [1, 3, 4, 6, 7, 8, 10, 13, 14]
```

#### Pre-Order Traversal (Root-Left-Right)

```typescript
const preOrder = bst.preOrderTraversal();
// Returns: [8, 3, 1, 6, 4, 7, 10, 14, 13]
```

#### Post-Order Traversal (Left-Right-Root)

```typescript
const postOrder = bst.postOrderTraversal();
// Returns: [1, 4, 7, 6, 3, 13, 14, 10, 8]
```

### Utility Methods

#### Check if Tree is Empty

```typescript
const empty = bst.isEmpty(); // returns false if tree has nodes
```

#### Get Tree Height

```typescript
const height = bst.getHeight(); // returns the height of the tree
```

#### Get Minimum Value

```typescript
const min = bst.getMin(); // returns the smallest value in the tree
```

#### Get Maximum Value

```typescript
const max = bst.getMax(); // returns the largest value in the tree
```

## Example: Working with Strings

```typescript
const nameBst = new BinarySearchTree<string>();
nameBst.insert("dog");
nameBst.insert("cat");
nameBst.insert("elephant");
nameBst.insert("ant");
nameBst.insert("fox");

console.log(nameBst.inOrderTraversal());
// Output: ["ant", "cat", "dog", "elephant", "fox"]

console.log(nameBst.search("cat")); // true
console.log(nameBst.search("zebra")); // false
```

## API Reference

### BinarySearchTree Class

#### Constructor

- `new BinarySearchTree<T>()`: Creates a new empty BST

#### Methods

- `insert(value: T): void` - Inserts a value into the BST
- `search(value: T): boolean` - Searches for a value, returns true if found
- `delete(value: T): void` - Deletes a value from the BST
- `inOrderTraversal(): T[]` - Returns values in sorted order
- `preOrderTraversal(): T[]` - Returns values in pre-order
- `postOrderTraversal(): T[]` - Returns values in post-order
- `isEmpty(): boolean` - Checks if the tree is empty
- `getHeight(): number` - Returns the height of the tree
- `getMin(): T | null` - Returns the minimum value or null if empty
- `getMax(): T | null` - Returns the maximum value or null if empty

### TreeNode Class

Represents a single node in the tree. Generally, you don't need to interact with this class directly.

#### Properties

- `value: T` - The value stored in the node
- `left: TreeNode<T> | null` - Reference to the left child
- `right: TreeNode<T> | null` - Reference to the right child

## Testing

The implementation includes comprehensive tests covering:

- Node creation
- Empty tree operations
- Insert operations (single, multiple, duplicates)
- Search operations (existing, non-existing values)
- Delete operations (all three cases)
- Traversal operations (in-order, pre-order, post-order)
- Utility methods
- String values
- Edge cases (single node, unbalanced tree)

Run the tests:

```bash
npm test -- binary-search-tree.spec.ts
```

## Implementation Details

### Delete Operation

The delete operation is the most complex and handles three scenarios:

1. **Leaf Node (No Children)**: Simply remove the node
2. **One Child**: Replace the node with its child
3. **Two Children**: Find the in-order successor (minimum value in right subtree), replace the node's value with the successor's value, then delete the successor

### No Duplicate Values

When inserting a duplicate value, the BST ignores it and maintains the unique values property.

### Unbalanced Trees

This is a basic BST implementation without self-balancing. In the worst case (e.g., inserting values in sorted order), the tree can become unbalanced and degrade to O(n) time complexity. For guaranteed O(log n) operations, consider self-balancing trees like AVL or Red-Black trees.

## References

For more information about Binary Search Trees:

- [Wikipedia: Binary Search Tree](https://en.wikipedia.org/wiki/Binary_search_tree)
- Useful in: databases, file systems, expression parsing, and more
- Related structures: AVL trees, Red-Black trees, B-trees

## License

This implementation is part of the d1-get-started repository.
