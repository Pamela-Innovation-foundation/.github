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

## API Reference

### Payment & Activation Flow

Use `/pay` and `/activate` to obtain an API key by sending ETH on-chain.

**Step 1 — Get payment instructions**

```bash
curl -s -X POST https://<your-worker>.workers.dev/pay \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "pro",
    "payer_address": "0xYourEthereumAddress"
  }'
```

Response:
```json
{
  "receiving_address": "0xYourReceivingWallet",
  "amount_wei": "10000000000000000",
  "amount_eth": "0.010000000000000000",
  "plan": "pro",
  "payer_address": "0xYourEthereumAddress",
  "instructions": "Send exactly 0.01 ETH from 0xYour... to 0xReceiving..., then POST /activate with your tx_hash, payer_address, and plan."
}
```

Available plans:

| Plan       | Monthly requests | Price      |
|------------|-----------------|------------|
| starter    | 1,000           | 0.001 ETH  |
| pro        | 10,000          | 0.01 ETH   |
| enterprise | Unlimited       | 0.1 ETH    |

**Step 2 — Send the ETH transaction** using your wallet, MetaMask, or `cast send`.

**Step 3 — Activate your key**

```bash
curl -s -X POST https://<your-worker>.workers.dev/activate \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "0xYourTransactionHash",
    "payer_address": "0xYourEthereumAddress",
    "plan": "pro"
  }'
```

Response (`201 Created`):
```json
{
  "api_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "plan": "pro",
  "monthly_limit": 10000,
  "reset_at": "2025-02-21 17:00:00",
  "message": "API key provisioned. Include it as X-API-Key header in requests."
}
```

**Step 4 — Use your API key**

```bash
curl -s https://<your-worker>.workers.dev/api/usage \
  -H "X-API-Key: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Protected Endpoints

All `/api/*` routes require the `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/usage` | Quota info for the current key |
| `GET` | `/api/webhooks` | List stored blockchain webhook events |
| `POST` | `/api/webhooks/blockchain` | Ingest a blockchain webhook event |
| `DELETE` | `/api/keys/:id` | Revoke an API key (admin only) |
| `GET` | `/api/eth-balance?address=0x…` | Query an Ethereum address balance |
| `GET` | `/api/eth-balance/history` | Recent balance lookup history |
| `GET` | `/api/landmarks?since=YYYY-MM-DD` | Infrastructure landmarks |
| `GET` | `/api/token-price?ids=ethereum,bitcoin` | Live token prices via CoinGecko |

### Rate Limiting

Unauthenticated endpoints (`/pay`, `/activate`) are rate-limited to **10 requests per IP per minute**. Exceeded requests receive `429 Too Many Requests`.



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
