/**
 * Example usage demonstrating the Binary Search Tree implementation
 * This file creates the example tree structure from the problem statement
 */

import { BinarySearchTree } from "./binary-search-tree";

console.log("=== Binary Search Tree Example ===\n");

// Create a new BST
const bst = new BinarySearchTree<number>();

// Build the example tree from the problem statement:
//        8
//       / \
//      3   10
//     / \    \
//    1   6    14
//       / \   /
//      4   7 13

console.log("Inserting values: 8, 3, 10, 1, 6, 14, 4, 7, 13");
bst.insert(8);
bst.insert(3);
bst.insert(10);
bst.insert(1);
bst.insert(6);
bst.insert(14);
bst.insert(4);
bst.insert(7);
bst.insert(13);

console.log("\n--- Tree Properties ---");
console.log("Height:", bst.getHeight());
console.log("Minimum value:", bst.getMin());
console.log("Maximum value:", bst.getMax());
console.log("Is empty:", bst.isEmpty());

console.log("\n--- Search Operations ---");
console.log("Search for 6:", bst.search(6));
console.log("Search for 15:", bst.search(15));
console.log("Search for 1:", bst.search(1));
console.log("Search for 5:", bst.search(5));

console.log("\n--- Traversal Operations ---");
console.log("In-order traversal (sorted):", bst.inOrderTraversal().join(", "));
console.log("Pre-order traversal:", bst.preOrderTraversal().join(", "));
console.log("Post-order traversal:", bst.postOrderTraversal().join(", "));

console.log("\n--- Delete Operations ---");
console.log("Deleting 1 (leaf node)...");
bst.delete(1);
console.log("In-order after deletion:", bst.inOrderTraversal().join(", "));

console.log("\nDeleting 10 (node with children)...");
bst.delete(10);
console.log("In-order after deletion:", bst.inOrderTraversal().join(", "));

console.log("\n--- String BST Example ---");
const stringBst = new BinarySearchTree<string>();
const animals = ["dog", "cat", "elephant", "ant", "fox", "bear"];
console.log("Inserting animals:", animals.join(", "));
animals.forEach((animal) => stringBst.insert(animal));
console.log(
  "Sorted animals (in-order):",
  stringBst.inOrderTraversal().join(", ")
);
console.log('Search for "cat":', stringBst.search("cat"));
console.log('Search for "zebra":', stringBst.search("zebra"));

console.log("\n=== Example Complete ===");
