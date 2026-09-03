/**
 * Example usage of the Project Name Guard Mechanism
 * 
 * This file demonstrates various use cases for the guard mechanism
 * in different scenarios.
 */

import {
  getProjectName,
  enableGuard,
  disableGuard,
  isGuardEnabled,
  setGuardConfig,
  resetGuard,
  applyProjectNameGuard,
} from './config';

/**
 * Example 1: Basic usage - Getting the project name
 */
export function example1_BasicUsage() {
  console.log('Example 1: Basic Usage');
  console.log('Current project name:', getProjectName());
  // Output: pamela (default with guard enabled)
}

/**
 * Example 2: Toggling the guard on and off
 */
export function example2_TogglingGuard() {
  console.log('\nExample 2: Toggling Guard');
  
  // Default state - guard is enabled
  console.log('Guard enabled:', isGuardEnabled());
  console.log('Project name:', getProjectName());
  
  // Disable guard
  disableGuard();
  console.log('After disabling - Project name:', getProjectName());
  
  // Re-enable guard
  enableGuard();
  console.log('After re-enabling - Project name:', getProjectName());
}

/**
 * Example 3: Applying guard to text replacement
 */
export function example3_TextReplacement() {
  console.log('\nExample 3: Text Replacement');
  
  const originalText = 'Welcome to My Cool Project! My Cool Project is awesome.';
  
  // With guard enabled
  enableGuard();
  const replacedText = applyProjectNameGuard(originalText);
  console.log('With guard enabled:', replacedText);
  
  // With guard disabled
  disableGuard();
  const unchangedText = applyProjectNameGuard(originalText);
  console.log('With guard disabled:', unchangedText);
  
  // Reset to default
  resetGuard();
}

/**
 * Example 4: Custom configuration for specific use cases
 */
export function example4_CustomConfiguration() {
  console.log('\nExample 4: Custom Configuration');
  
  // Set custom names for a special deployment
  setGuardConfig({
    originalName: 'GenericApp',
    replacementName: 'CustomBrand',
    enabled: true,
  });
  
  const text = 'This is GenericApp version 2.0';
  console.log('Custom replacement:', applyProjectNameGuard(text));
  
  // Reset to defaults
  resetGuard();
}

/**
 * Example 5: Testing scenario - temporarily disable guard
 */
export function example5_TestingScenario() {
  console.log('\nExample 5: Testing Scenario');
  
  // Save current state
  const wasEnabled = isGuardEnabled();
  
  try {
    // Disable guard for testing original behavior
    disableGuard();
    console.log('Testing with original name:', getProjectName());
    
    // Test your code here...
    const message = applyProjectNameGuard('My Cool Project test');
    console.log('Test message:', message);
    
  } finally {
    // Restore original state
    if (wasEnabled) {
      enableGuard();
    }
    console.log('Restored state. Guard enabled:', isGuardEnabled());
  }
}

/**
 * Example 6: Debugging with custom labels
 */
export function example6_DebuggingMode() {
  console.log('\nExample 6: Debugging Mode');
  
  // Temporarily set debug label
  setGuardConfig({
    replacementName: '[DEBUG]',
    enabled: true,
  });
  
  console.log('Debug project name:', getProjectName());
  const debugMsg = applyProjectNameGuard('My Cool Project is running');
  console.log('Debug message:', debugMsg);
  
  // Reset when done debugging
  resetGuard();
  console.log('After reset:', getProjectName());
}

/**
 * Example 7: Environment-specific configuration
 */
export function example7_EnvironmentConfig(environment: string = 'production') {
  console.log('\nExample 7: Environment-Specific Config');
  
  if (environment === 'development') {
    setGuardConfig({ replacementName: 'pamela-dev' });
  } else if (environment === 'staging') {
    setGuardConfig({ replacementName: 'pamela-staging' });
  } else {
    setGuardConfig({ replacementName: 'pamela' });
  }
  
  console.log(`${environment} project name:`, getProjectName());
  
  resetGuard();
}

/**
 * Example 8: Batch text processing
 */
export function example8_BatchProcessing() {
  console.log('\nExample 8: Batch Processing');
  
  const messages = [
    'Welcome to My Cool Project',
    'My Cool Project - Documentation',
    'Contact My Cool Project support',
  ];
  
  enableGuard();
  const processedMessages = messages.map(msg => applyProjectNameGuard(msg));
  
  console.log('Original messages:', messages);
  console.log('Processed messages:', processedMessages);
}

// Run all examples (uncomment to execute)
// example1_BasicUsage();
// example2_TogglingGuard();
// example3_TextReplacement();
// example4_CustomConfiguration();
// example5_TestingScenario();
// example6_DebuggingMode();
// example7_EnvironmentConfig();
// example8_BatchProcessing();
