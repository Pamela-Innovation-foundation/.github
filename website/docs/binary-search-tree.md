---
id: binary-search-tree
sidebar_position: 4
---

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
```

### Searching

```typescript
const found = bst.search(6); // Returns the node with value 6
const notFound = bst.search(100); // Returns null
```

### Traversals

```typescript
// In-order traversal (sorted ascending)
const sorted = bst.inOrder(); // [1, 3, 6, 8, 10]

// Pre-order traversal
const preOrder = bst.preOrder(); // [8, 3, 1, 6, 10]

// Post-order traversal
const postOrder = bst.postOrder(); // [1, 6, 3, 10, 8]
```

### Deletion

```typescript
bst.delete(3); // Removes node with value 3
```

## Implementation Details

The BST is implemented in `src/binary-search-tree.ts` using TypeScript generics to support any comparable type. The implementation includes:

- `BSTNode<T>` class for tree nodes
- `BinarySearchTree<T>` class with full CRUD operations
- Type-safe comparator support
- Iterative and recursive operations

See `src/bst-example.ts` for complete usage examples.
