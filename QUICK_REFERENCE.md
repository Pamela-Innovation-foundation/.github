# Quick Reference: Project Name Guard

## TL;DR
```typescript
import { getProjectName, enableGuard, disableGuard } from './src/config';

// Get current project name (default: 'pamela')
const name = getProjectName();

// Disable guard to use 'My Cool Project'
disableGuard();

// Re-enable guard to use 'pamela'
enableGuard();
```

## Common Use Cases

### 1. Get Current Project Name
```typescript
import { getProjectName } from './src/config';
const name = getProjectName(); // 'pamela' (when guard enabled)
```

### 2. Replace Text
```typescript
import { applyProjectNameGuard } from './src/config';
const text = applyProjectNameGuard('Welcome to My Cool Project!');
// Result: 'Welcome to pamela!'
```

### 3. Testing with Original Name
```typescript
import { disableGuard, enableGuard } from './src/config';

disableGuard(); // Use 'My Cool Project'
// ... run tests ...
enableGuard(); // Back to 'pamela'
```

### 4. Custom Configuration
```typescript
import { setGuardConfig } from './src/config';

setGuardConfig({
  replacementName: 'my-custom-name',
  enabled: true
});
```

### 5. Temporary Changes
```typescript
import { resetGuard, setGuardConfig } from './src/config';

// Make temporary change
setGuardConfig({ replacementName: 'DEBUG' });
// ... debug code ...
resetGuard(); // Back to defaults
```

## API Endpoints (Worker)

```bash
# Get current project name
GET /api/project-name
# Response: {"projectName":"pamela"}

# Default endpoint (shows guard in action)
GET /
# Response: "Welcome to pamela! ..."
```

## All Functions

| Function | Description |
|----------|-------------|
| `getProjectName()` | Returns current project name |
| `enableGuard()` | Enable guard (use 'pamela') |
| `disableGuard()` | Disable guard (use 'My Cool Project') |
| `isGuardEnabled()` | Check if guard is enabled |
| `setGuardConfig(config)` | Update configuration |
| `getGuardConfig()` | Get current configuration |
| `resetGuard()` | Reset to defaults |
| `applyProjectNameGuard(text)` | Apply replacement to text |

## More Details
See [GUARD_MECHANISM.md](./GUARD_MECHANISM.md) for complete documentation and examples.
