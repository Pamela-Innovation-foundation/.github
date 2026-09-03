# Project Name Guard Mechanism

This module implements a guard mechanism that allows conditional replacement of project names across the repository. This is useful for testing, debugging, and maintaining different configurations.

## Overview

The guard mechanism provides a programmatic way to control whether instances of "My Cool Project" are replaced with "pamela" throughout the application.

## Features

- **Toggle Control**: Enable or disable replacement programmatically
- **Custom Configuration**: Set custom original and replacement names
- **Runtime Control**: Change behavior at runtime for testing and debugging
- **Type-Safe**: Full TypeScript support with proper typing

## Usage

### Basic Usage

```typescript
import { getProjectName, applyProjectNameGuard } from './config';

// Get the current project name (defaults to 'pamela' when guard is enabled)
const name = getProjectName();
console.log(name); // 'pamela'

// Apply guard to text containing the original name
const message = applyProjectNameGuard('Welcome to My Cool Project!');
console.log(message); // 'Welcome to pamela!'
```

### Toggling the Guard

```typescript
import { enableGuard, disableGuard, isGuardEnabled } from './config';

// Disable guard for testing original behavior
disableGuard();
console.log(getProjectName()); // 'My Cool Project'

// Re-enable guard
enableGuard();
console.log(getProjectName()); // 'pamela'

// Check current state
if (isGuardEnabled()) {
  console.log('Guard is active');
}
```

### Custom Configuration

```typescript
import { setGuardConfig, getGuardConfig } from './config';

// Set custom names for specific use cases
setGuardConfig({
  originalName: 'OldProjectName',
  replacementName: 'NewProjectName',
  enabled: true
});

// Get current configuration
const config = getGuardConfig();
console.log(config);
// { enabled: true, originalName: 'OldProjectName', replacementName: 'NewProjectName' }
```

### Reset to Default

```typescript
import { resetGuard } from './config';

// After making temporary changes, reset to defaults
resetGuard();
```

## API Reference

### Functions

#### `getProjectName(): string`
Returns the current project name based on guard configuration.
- Returns replacement name when guard is enabled
- Returns original name when guard is disabled

#### `enableGuard(): void`
Enables the guard mechanism to use the replacement name.

#### `disableGuard(): void`
Disables the guard mechanism to use the original name.

#### `isGuardEnabled(): boolean`
Checks if the guard is currently enabled.

#### `setGuardConfig(config: Partial<ProjectNameGuard>): void`
Updates the guard configuration. Accepts partial configuration object.

#### `getGuardConfig(): Readonly<ProjectNameGuard>`
Returns a copy of the current guard configuration.

#### `resetGuard(): void`
Resets the guard to its default configuration.

#### `applyProjectNameGuard(text: string): string`
Applies the guard mechanism to replace project names in text.
- When enabled: replaces all instances of original name with replacement name
- When disabled: returns text unchanged

## Testing

The guard mechanism is thoroughly tested. See `test/config.spec.ts` for examples.

```bash
npm test
```

## Example: Debugging with Guard

```typescript
import { setGuardConfig, resetGuard } from './config';

// Save original config
const originalConfig = getGuardConfig();

try {
  // Temporarily change for debugging
  setGuardConfig({ 
    replacementName: 'DEBUG_MODE',
    enabled: true 
  });
  
  // Your debugging code here
  const message = applyProjectNameGuard('Running My Cool Project');
  console.log(message); // 'Running DEBUG_MODE'
  
} finally {
  // Restore original configuration
  resetGuard();
}
```

## Integration with Worker

The guard is integrated into the Cloudflare Worker to demonstrate its usage:

```typescript
// GET /api/project-name - Returns current project name
// GET / - Returns welcome message with guarded project name
```

Example:
```bash
# With guard enabled (default)
curl https://your-worker.workers.dev/api/project-name
# {"projectName":"pamela"}

# Welcome message includes guarded name
curl https://your-worker.workers.dev/
# "Welcome to pamela! ..."
```
