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

# Store a valid Ethereum receiving wallet (0x + 40 hex chars)
wrangler secret put RECEIVING_WALLET
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
- **ERC-1155 Export API**: Export mint and transfer activity as JSON or CSV
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

## ERC-1155 Export API

Use the authenticated `/api/erc1155/export` endpoint to export ERC-1155
activity for a contract and block range.

### Query parameters

- `fromBlock` and `toBlock` are required decimal block numbers
- `contract` is optional and defaults to the sample ERC-1155 contract
- `address` optionally filters rows to a participant wallet
- `tokenId` defaults to `1`
- `type` accepts `mints`, `transfers`, or `all`
- `format` accepts `json` or `csv`

### Safety notes

- The Worker rejects invalid Ethereum wallet addresses, including a malformed
  `RECEIVING_WALLET` secret
- Export requests are limited to a maximum span of 20,000 blocks per request
- Payment flows require `RECEIVING_WALLET` to be configured as a valid
  Ethereum address before `/pay` or `/activate` can succeed

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
