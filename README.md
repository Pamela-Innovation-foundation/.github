# pamela

A Cloudflare Workers project using D1 database.

## Getting Started

This is pamela, a starter template for working with Cloudflare D1.

### Prerequisites

- Node.js installed
- A Cloudflare account
- Wrangler CLI installed

### Installation

```bash
npm install
```

### Install GitHub Copilot CLI

Choose the command for your platform/package manager:

```bash
# Windows (stable)
winget install GitHub.Copilot

# Windows (prerelease)
winget install GitHub.Copilot.Prerelease

# macOS (stable)
brew install --cask copilot-cli

# macOS (prerelease)
brew install --cask copilot-cli@prerelease

# npm global (stable)
npm install -g @github/copilot

# npm global (prerelease)
npm install -g @github/copilot@prerelease
```

Or install via the official script.
Always review any remote install script before executing it:
https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli

```bash
# curl (download, review, then run)
curl -fsSL https://gh.io/copilot-install -o /tmp/copilot-install.sh
cat /tmp/copilot-install.sh
bash /tmp/copilot-install.sh

# wget (download, review, then run)
wget -qO /tmp/copilot-install.sh https://gh.io/copilot-install
cat /tmp/copilot-install.sh
bash /tmp/copilot-install.sh

# pin version + custom install prefix
VERSION="v0.0.369" PREFIX="$HOME/custom" bash /tmp/copilot-install.sh
```

### Development

```bash
npm run dev
```

### Lint Requirements

Linting and formatting dependencies are pinned in [`lint_requirements.txt`](./lint_requirements.txt). This mirrors the convention used in [coinbase/coinbase-advanced-py](https://github.com/coinbase/coinbase-advanced-py) to make lint tooling versions explicit and reproducible.

The file lists the exact versions of ESLint, Prettier, and related plugins used for code quality checks.

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

## Blockscout proxy

The worker exposes a small read-only proxy for the [Blockscout](https://blockscout.com/) REST API under `/api/blockscout/*`. All routes require the standard `X-API-Key` header and are `GET`-only.

Routes:

- `GET /api/blockscout/stats` — explorer Stats API root.
- `GET /api/blockscout/stats/charts/transactions` — transactions chart (query string forwarded).
- `GET /api/blockscout/stats/charts/market` — market chart (query string forwarded).
- `GET /api/blockscout/contracts/{address}/audit-reports` — audit reports for a contract on the default chain (`BLOCKSCOUT_DEFAULT_CHAIN_ID`).
- `GET /api/blockscout/chains/{chainId}/contracts/{address}/audit-reports` — audit reports for a contract on an explicit chain.

`{address}` must be a `0x`-prefixed 40-hex-char address and `{chainId}` must be numeric; otherwise the worker returns `400` without contacting the upstream. Upstream 5xx responses and network failures are mapped to `502 { "error": "Upstream error" }` to avoid leaking upstream details.

Configuration (in `wrangler.jsonc` `vars`):

- `BLOCKSCOUT_MULTICHAIN_BASE_URL` — base URL for the `{chain_id}`-scoped multichain API (default `https://api.blockscout.com`).
- `BLOCKSCOUT_EXPLORER_BASE_URL` — base URL for the per-explorer Stats API (default `https://explorer.testnet.chain.robinhood.com`).
- `BLOCKSCOUT_DEFAULT_CHAIN_ID` — numeric chain id used by the shorthand audit-reports route. Leave blank to require an explicit `chainId` in the URL.

Optional secret:

```bash
wrangler secret put BLOCKSCOUT_API_TOKEN
```

When set, the worker attaches an `Authorization` bearer header only on calls to the multichain API (`BLOCKSCOUT_MULTICHAIN_BASE_URL`). The Stats API is called without authentication.

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

## License

Licensed under either of the Apache License, Version 2.0 (LICENSE-APACHE) or the MIT license (LICENSE-MIT), at your option. Copyright (c) 2026 Pamela Richardson.

`worker-configuration.d.ts` is generated by Wrangler and includes runtime type definitions copyright Cloudflare and Microsoft Corporation. That file stays under the Apache License, Version 2.0 notice already embedded in it, and is not relicensed by the dual license above.
