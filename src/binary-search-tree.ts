/**
 * Binary Search Tree (BST) Implementation
 *
 * A data structure that organizes data in a hierarchical tree format,
 * where each node has at most two children: a left child and a right child.
 *
 * Key Properties:
 * - For any given node, all nodes in its left subtree have values less than the node's value
 * - All nodes in its right subtree have values greater than the node's value
 * - No duplicate values are allowed
 *
 * Time Complexities (Average Case):
 * - Search: O(log n)
 * - Insert: O(log n)
 * - Delete: O(log n)
 * - Worst Case (unbalanced tree): O(n)
 */

/**
 * TreeNode represents a single node in the binary search tree
 */
export class TreeNode<T> {
  value: T;
  left: TreeNode<T> | null;
  right: TreeNode<T> | null;

  constructor(value: T) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

/**
 * BinarySearchTree class implementing BST operations
 */
export class BinarySearchTree<T> {
  root: TreeNode<T> | null;

  constructor() {
    this.root = null;
  }

  /**
   * Insert a value into the BST
   * Average time complexity: O(log n)
   * @param value - The value to insert
   */
  insert(value: T): void {
    const newNode = new TreeNode(value);

    if (this.root === null) {
      this.root = newNode;
      return;
    }

    this.insertNode(this.root, newNode);
  }

  /**
   * Helper method to recursively insert a node
   */
  private insertNode(node: TreeNode<T>, newNode: TreeNode<T>): void {
    if (newNode.value < node.value) {
      // Insert in left subtree
      if (node.left === null) {
        node.left = newNode;
      } else {
        this.insertNode(node.left, newNode);
      }
    } else if (newNode.value > node.value) {
      // Insert in right subtree
      if (node.right === null) {
        node.right = newNode;
      } else {
        this.insertNode(node.right, newNode);
      }
    }
    // If values are equal, do nothing (no duplicates allowed)
  }

  /**
   * Search for a value in the BST
   * Average time complexity: O(log n)
   * @param value - The value to search for
   * @returns true if found, false otherwise
   */
  search(value: T): boolean {
    return this.searchNode(this.root, value);
  }

  /**
   * Helper method to recursively search for a node
   */
  private searchNode(node: TreeNode<T> | null, value: T): boolean {
    if (node === null) {
      return false;
    }

    if (value < node.value) {
      return this.searchNode(node.left, value);
    } else if (value > node.value) {
      return this.searchNode(node.right, value);
    } else {
      return true; // Value found
    }
  }

  /**
   * Delete a value from the BST
   * Average time complexity: O(log n)
   * Handles three cases:
   * 1. Node with no children (leaf node)
   * 2. Node with one child
   * 3. Node with two children
   * @param value - The value to delete
   */
  delete(value: T): void {
    this.root = this.deleteNode(this.root, value);
  }

  /**
   * Helper method to recursively delete a node
   */
  private deleteNode(node: TreeNode<T> | null, value: T): TreeNode<T> | null {
    if (node === null) {
      return null;
    }

    if (value < node.value) {
      node.left = this.deleteNode(node.left, value);
      return node;
    } else if (value > node.value) {
      node.right = this.deleteNode(node.right, value);
      return node;
    } else {
      // Node to be deleted found

      // Case 1: Node with no children (leaf node)
      if (node.left === null && node.right === null) {
        return null;
      }

      // Case 2: Node with one child
      if (node.left === null) {
        return node.right;
      }
      if (node.right === null) {
        return node.left;
      }

      // Case 3: Node with two children
      // Find the minimum value in the right subtree (in-order successor)
      const minRight = this.findMinNode(node.right);
      node.value = minRight.value;
      // Delete the in-order successor
      node.right = this.deleteNode(node.right, minRight.value);
      return node;
    }
  }

  /**
   * Find the node with minimum value in a subtree
   */
  private findMinNode(node: TreeNode<T>): TreeNode<T> {
    while (node.left !== null) {
      node = node.left;
    }
    return node;
  }

  /**
   * In-order traversal (left-root-right)
   * Visits nodes in sorted order
   * @returns Array of values in sorted order
   */
  inOrderTraversal(): T[] {
    const result: T[] = [];
    this.inOrder(this.root, result);
    return result;
  }

  private inOrder(node: TreeNode<T> | null, result: T[]): void {
    if (node !== null) {
      this.inOrder(node.left, result);
      result.push(node.value);
      this.inOrder(node.right, result);
    }
  }

  /**
   * Pre-order traversal (root-left-right)
   * @returns Array of values in pre-order
   */
  preOrderTraversal(): T[] {
    const result: T[] = [];
    this.preOrder(this.root, result);
    return result;
  }

  private preOrder(node: TreeNode<T> | null, result: T[]): void {
    if (node !== null) {
      result.push(node.value);
      this.preOrder(node.left, result);
      this.preOrder(node.right, result);
    }
  }

  /**
   * Post-order traversal (left-right-root)
   * @returns Array of values in post-order
   */
  postOrderTraversal(): T[] {
    const result: T[] = [];
    this.postOrder(this.root, result);
    return result;
  }

  private postOrder(node: TreeNode<T> | null, result: T[]): void {
    if (node !== null) {
      this.postOrder(node.left, result);
      this.postOrder(node.right, result);
      result.push(node.value);
    }
  }

  /**
   * Get the height of the tree
   * @returns The height of the tree
   */
  getHeight(): number {
    return this.calculateHeight(this.root);
  }

  private calculateHeight(node: TreeNode<T> | null): number {
    if (node === null) {
      return 0;
    }
    const leftHeight = this.calculateHeight(node.left);
    const rightHeight = this.calculateHeight(node.right);
    return Math.max(leftHeight, rightHeight) + 1;
  }

  /**
   * Check if the tree is empty
   * @returns true if empty, false otherwise
   */
  isEmpty(): boolean {
    return this.root === null;
  }

  /**
   * Get the minimum value in the tree
   * @returns The minimum value or null if tree is empty
   */
  getMin(): T | null {
    if (this.root === null) {
      return null;
    }
    const minNode = this.findMinNode(this.root);
    return minNode.value;
  }

  /**
   * Get the maximum value in the tree
   * @returns The maximum value or null if tree is empty
   */
  getMax(): T | null {
    if (this.root === null) {
      return null;
    }
    let node = this.root;
    while (node.right !== null) {
      node = node.right;
    }
    return node.value;
  }
}
