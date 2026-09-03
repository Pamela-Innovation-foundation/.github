# pamela

A Cloudflare Workers project using D1 database with a configurable project name guard mechanism.

## Getting Started

This is pamela, a starter template for working with Cloudflare D1.

## Features

- **D1 Database Integration**: Demonstrates Cloudflare D1 database usage
- **Project Name Guard Mechanism**: Conditional project name replacement for testing and debugging
- **TypeScript Support**: Full TypeScript implementation
- **Comprehensive Testing**: Unit and integration tests with Vitest

## Project Name Guard

This project includes a guard mechanism that allows conditional replacement of project names throughout the codebase. This feature is useful for:
- Testing different configurations
- Debugging with custom labels
- Managing multi-environment deployments

For detailed documentation, see [GUARD_MECHANISM.md](./GUARD_MECHANISM.md).

### Quick Example

```typescript
import { getProjectName, disableGuard, enableGuard } from './src/config';

// Default behavior (guard enabled)
console.log(getProjectName()); // 'pamela'

// Disable for testing
disableGuard();
console.log(getProjectName()); // 'My Cool Project'

// Re-enable
enableGuard();
console.log(getProjectName()); // 'pamela'
```

### Prerequisites

- Node.js installed
- A Cloudflare account
- Wrangler CLI installed

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Deployment

```bash
npm run deploy
```

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.
