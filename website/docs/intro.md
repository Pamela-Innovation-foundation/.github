---
id: intro
sidebar_position: 1
---

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

For detailed security setup instructions, see [API Security](./api-security).

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.

## Features

- **D1 Database Integration**: Store and query data using Cloudflare's D1 database
- **API Key Authentication**: Secure API endpoints with API key authentication (see [API Security](./api-security))
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript
- **MCP Server Support**: Configured for Model Context Protocol (MCP) integration with AI tools

## Database Schema

### Customers Table

```sql
CREATE TABLE Customers (
  CustomerId INTEGER PRIMARY KEY,
  CompanyName TEXT,
  ContactName TEXT
);
```

### BlockchainWebhooks Table

```sql
CREATE TABLE BlockchainWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
```

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
