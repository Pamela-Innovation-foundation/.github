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

```bash
npm run deploy
```

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.

## Features

- **D1 Database Integration**: Store and query data using Cloudflare's D1 database
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript

## Blockchain Integration

This project includes a blockchain webhook handler that can receive and store webhook notifications from Ethereum (ETH) and other blockchain networks.

**Looking for information about "Open ETH"?** See [BLOCKCHAIN_GUIDE.md](./BLOCKCHAIN_GUIDE.md) for detailed information about:

- What "Open ETH" means in different contexts
- OpenZeppelin Ethereum contracts
- How to use the blockchain webhook handler
- Getting started with Ethereum development

The blockchain webhook is implemented in the main worker (`src/index.ts`) and handles POST requests to the `/webhook` endpoint.
