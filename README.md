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
import { getProjectName, disableGuard, enableGuard } from "./src/config";

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

### Validate Before Review

Run these checks before opening or updating a PR:

```bash
npm run format:check
npm run lint
npm run build
npm test
```

### Deployment

Before deploying, make sure to set up your API key secret:

```bash
# Generate a secure API key
openssl rand -hex 32

# Store it as a Wrangler secret
wrangler secret put API_KEY
```

Then deploy:

```bash
npm run deploy
```

For detailed security setup instructions, see [API_SECURITY.md](./API_SECURITY.md).

## Copilot and Agent Instructions

- Copilot-specific repository guidance:
  [.github/copilot-instructions.md](./.github/copilot-instructions.md)
- General AI coding agent guidance: [AGENTS.md](./AGENTS.md)

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.

## Features

- **D1 Database Integration**: Store and query data using Cloudflare's D1 database
- **API Key Authentication**: Secure API endpoints with API key authentication (see [API_SECURITY.md](./API_SECURITY.md))
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript
- **MCP Server Support**: Configured for Model Context Protocol (MCP) integration with AI tools

## Blockchain Integration

This project includes a blockchain webhook handler that can receive and store webhook notifications from Ethereum (ETH) and other blockchain networks.

**Looking for information about "Open ETH"?** See [BLOCKCHAIN_GUIDE.md](./BLOCKCHAIN_GUIDE.md) for detailed information about:

- What "Open ETH" means in different contexts
- OpenZeppelin Ethereum contracts
- How to use the blockchain webhook handler
- Getting started with Ethereum development

For webhook implementation details, see `src/blockchain-webhook.js`.

## MCP Server Configuration

This project includes Model Context Protocol (MCP) server configuration in `.devcontainer/devcontainer.json`. The following MCP servers are configured:

### Filesystem Server

- **Purpose**: Provides file system access for AI tools
- **Command**: `npx @modelcontextprotocol/server-filesystem`
- **Scope**: Project directory access

### GitHub Server

- **Purpose**: Enables GitHub repository integration for AI tools
- **Command**: `npx @modelcontextprotocol/server-github`
- **Requirements**: GitHub personal access token via `GITHUB_TOKEN` environment variable

These MCP servers enable AI-powered development tools to interact with the project's codebase and GitHub repository.
