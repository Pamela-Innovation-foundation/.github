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
- **Customers API**: List customers stored in the D1 database
- **Landmarks API**: Query landmark records with optional date filtering
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript
- **MCP Server Support**: Configured for Model Context Protocol (MCP) integration with AI tools

## API Reference

All endpoints under `/api/` require the `X-API-Key` header. See [API_SECURITY.md](./API_SECURITY.md) for setup instructions.

### GET /api/customers

Returns customers from the database. Supports pagination via `limit` and `offset` query parameters.

| Parameter | Default | Max   | Description                 |
| --------- | ------- | ----- | --------------------------- |
| `limit`   | `20`    | `100` | Number of records to return |
| `offset`  | `0`     | —     | Number of records to skip   |

**Request**

```bash
curl "https://<your-worker>.workers.dev/api/customers?limit=10&offset=0" \
  -H "X-API-Key: <your-api-key>"
```

**Response**

```json
{
  "customers": [
    {
      "CustomerId": 1,
      "CompanyName": "Alfreds Futterkiste",
      "ContactName": "Maria Anders"
    }
  ],
  "limit": 10,
  "offset": 0
}
```

### GET /api/landmarks

Returns landmarks created on or after the optional `since` date (defaults to `2024-01-01T00:00:00`). Supports pagination via `limit` and `offset` query parameters.

| Parameter | Default               | Max   | Description                                  |
| --------- | --------------------- | ----- | -------------------------------------------- |
| `since`   | `2024-01-01T00:00:00` | —     | Filter records created on or after this date |
| `limit`   | `20`                  | `100` | Number of records to return                  |
| `offset`  | `0`                   | —     | Number of records to skip                    |

**Request**

```bash
curl "https://<your-worker>.workers.dev/api/landmarks?since=2024-06-01&limit=5&offset=0" \
  -H "X-API-Key: <your-api-key>"
```

**Response**

```json
{
  "landmarks": [
    {
      "id": 3,
      "name": "Grand Egyptian Museum",
      "location": "Giza, Egypt",
      "description": "The largest archaeological museum in the world.",
      "created_at": "2024-06-01"
    }
  ],
  "limit": 5,
  "offset": 0
}
```

### POST /api/webhook

Receives a JSON blockchain event, stores it in the database, and returns
`201 Created` with a storage timestamp.

**Request**

```bash
curl -X POST https://<your-worker>.workers.dev/api/webhook \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"network": "ethereum", "event": "Transfer", "txHash": "0xabc..."}'
```

**Response**

```json
{ "success": true, "timestamp": "2024-06-01T12:00:00.000Z" }
```

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
