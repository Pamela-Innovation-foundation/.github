// test/binary-search-tree.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import { BinarySearchTree, TreeNode } from "../src/binary-search-tree";

describe("BinarySearchTree", () => {
  describe("TreeNode", () => {
    it("should create a node with the given value", () => {
      const node = new TreeNode(10);
      expect(node.value).toBe(10);
      expect(node.left).toBeNull();
      expect(node.right).toBeNull();
    });
  });

  describe("Construction", () => {
    it("should create an empty tree", () => {
      const bst = new BinarySearchTree<number>();
      expect(bst.root).toBeNull();
      expect(bst.isEmpty()).toBe(true);
    });
  });

  describe("Insert Operation", () => {
    it("should insert a single value as root", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      expect(bst.root).not.toBeNull();
      expect(bst.root?.value).toBe(8);
      expect(bst.isEmpty()).toBe(false);
    });

    it("should insert multiple values maintaining BST property", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);
      bst.insert(6);
      bst.insert(14);
      bst.insert(4);
      bst.insert(7);
      bst.insert(13);

      // Verify structure
      expect(bst.root?.value).toBe(8);
      expect(bst.root?.left?.value).toBe(3);
      expect(bst.root?.right?.value).toBe(10);
      expect(bst.root?.left?.left?.value).toBe(1);
      expect(bst.root?.left?.right?.value).toBe(6);
      expect(bst.root?.right?.right?.value).toBe(14);
      expect(bst.root?.left?.right?.left?.value).toBe(4);
      expect(bst.root?.left?.right?.right?.value).toBe(7);
      expect(bst.root?.right?.right?.left?.value).toBe(13);
    });

    it("should not insert duplicate values", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(5);
      bst.insert(3);
      bst.insert(7);
      bst.insert(5); // Duplicate

      // In-order should not have duplicates
      const inOrder = bst.inOrderTraversal();
      expect(inOrder).toEqual([3, 5, 7]);
      expect(inOrder.length).toBe(3);
    });
  });

  describe("Search Operation", () => {
    it("should find existing values", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);
      bst.insert(6);

      expect(bst.search(8)).toBe(true);
      expect(bst.search(3)).toBe(true);
      expect(bst.search(10)).toBe(true);
      expect(bst.search(1)).toBe(true);
      expect(bst.search(6)).toBe(true);
    });

    it("should not find non-existing values", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);

      expect(bst.search(5)).toBe(false);
      expect(bst.search(15)).toBe(false);
      expect(bst.search(0)).toBe(false);
    });

    it("should return false for empty tree", () => {
      const bst = new BinarySearchTree<number>();
      expect(bst.search(5)).toBe(false);
    });
  });

  describe("Delete Operation", () => {
    it("should delete a leaf node (no children)", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);

      bst.delete(1);
      expect(bst.search(1)).toBe(false);
      expect(bst.inOrderTraversal()).toEqual([3, 8, 10]);
    });

    it("should delete a node with one child (left)", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);

      bst.delete(3);
      expect(bst.search(3)).toBe(false);
      expect(bst.search(1)).toBe(true);
      expect(bst.inOrderTraversal()).toEqual([1, 8, 10]);
    });

    it("should delete a node with one child (right)", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(14);

      bst.delete(10);
      expect(bst.search(10)).toBe(false);
      expect(bst.search(14)).toBe(true);
      expect(bst.inOrderTraversal()).toEqual([3, 8, 14]);
    });

    it("should delete a node with two children", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);
      bst.insert(6);
      bst.insert(14);
      bst.insert(4);
      bst.insert(7);
      bst.insert(13);

      bst.delete(3);
      expect(bst.search(3)).toBe(false);
      expect(bst.search(4)).toBe(true);
      expect(bst.search(1)).toBe(true);
      expect(bst.search(6)).toBe(true);
      // The successor (4) should replace 3
      expect(bst.root?.left?.value).toBe(4);
    });

    it("should delete root node", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);

      bst.delete(8);
      expect(bst.search(8)).toBe(false);
      expect(bst.root?.value).toBe(10);
    });

    it("should handle deleting from empty tree", () => {
      const bst = new BinarySearchTree<number>();
      bst.delete(5); // Should not throw
      expect(bst.isEmpty()).toBe(true);
    });

    it("should handle deleting non-existent value", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);

      bst.delete(5); // Non-existent
      expect(bst.inOrderTraversal()).toEqual([3, 8, 10]);
    });
  });

  describe("Traversal Operations", () => {
    let bst: BinarySearchTree<number>;

    beforeEach(() => {
      bst = new BinarySearchTree<number>();
      // Build the example tree from problem statement:
      //        8
      //       / \
      //      3   10
      //     / \    \
      //    1   6    14
      //       / \   /
      //      4   7 13
      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);
      bst.insert(6);
      bst.insert(14);
      bst.insert(4);
      bst.insert(7);
      bst.insert(13);
    });

    it("should perform in-order traversal (sorted order)", () => {
      const result = bst.inOrderTraversal();
      expect(result).toEqual([1, 3, 4, 6, 7, 8, 10, 13, 14]);
    });

    it("should perform pre-order traversal", () => {
      const result = bst.preOrderTraversal();
      expect(result).toEqual([8, 3, 1, 6, 4, 7, 10, 14, 13]);
    });

    it("should perform post-order traversal", () => {
      const result = bst.postOrderTraversal();
      expect(result).toEqual([1, 4, 7, 6, 3, 13, 14, 10, 8]);
    });

    it("should return empty array for empty tree traversals", () => {
      const emptyBst = new BinarySearchTree<number>();
      expect(emptyBst.inOrderTraversal()).toEqual([]);
      expect(emptyBst.preOrderTraversal()).toEqual([]);
      expect(emptyBst.postOrderTraversal()).toEqual([]);
    });
  });

  describe("Utility Methods", () => {
    it("should calculate tree height correctly", () => {
      const bst = new BinarySearchTree<number>();
      expect(bst.getHeight()).toBe(0);

      bst.insert(8);
      expect(bst.getHeight()).toBe(1);

      bst.insert(3);
      bst.insert(10);
      expect(bst.getHeight()).toBe(2);

      bst.insert(1);
      bst.insert(6);
      bst.insert(14);
      bst.insert(4);
      bst.insert(7);
      bst.insert(13);
      expect(bst.getHeight()).toBe(4);
    });

    it("should find minimum value", () => {
      const bst = new BinarySearchTree<number>();
      expect(bst.getMin()).toBeNull();

      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(1);
      bst.insert(6);

      expect(bst.getMin()).toBe(1);
    });

    it("should find maximum value", () => {
      const bst = new BinarySearchTree<number>();
      expect(bst.getMax()).toBeNull();

      bst.insert(8);
      bst.insert(3);
      bst.insert(10);
      bst.insert(14);
      bst.insert(6);

      expect(bst.getMax()).toBe(14);
    });
  });

  describe("String Values", () => {
    it("should work with string values", () => {
      const bst = new BinarySearchTree<string>();
      bst.insert("dog");
      bst.insert("cat");
      bst.insert("elephant");
      bst.insert("ant");
      bst.insert("fox");

      expect(bst.search("cat")).toBe(true);
      expect(bst.search("zebra")).toBe(false);
      expect(bst.inOrderTraversal()).toEqual([
        "ant",
        "cat",
        "dog",
        "elephant",
        "fox",
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle single node tree", () => {
      const bst = new BinarySearchTree<number>();
      bst.insert(5);

      expect(bst.search(5)).toBe(true);
      expect(bst.getMin()).toBe(5);
      expect(bst.getMax()).toBe(5);
      expect(bst.getHeight()).toBe(1);
      expect(bst.inOrderTraversal()).toEqual([5]);

      bst.delete(5);
      expect(bst.isEmpty()).toBe(true);
    });

    it("should handle unbalanced tree (worst case - like linked list)", () => {
      const bst = new BinarySearchTree<number>();
      // Insert in ascending order to create worst case
      bst.insert(1);
      bst.insert(2);
      bst.insert(3);
      bst.insert(4);
      bst.insert(5);

      expect(bst.getHeight()).toBe(5);
      expect(bst.inOrderTraversal()).toEqual([1, 2, 3, 4, 5]);
      expect(bst.search(3)).toBe(true);
    });
  });
});
