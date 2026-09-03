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
- **Unified Worker**: Single entry point handling multiple endpoints:
  - `/api/beverages` - Query customer data from D1 database
  - `/webhook` - Receive and process blockchain webhook events
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript

## API Endpoints

### GET /api/beverages
Retrieves customer data from the D1 database.

**Example Response:**
```json
[
  {
    "CustomerId": 11,
    "CompanyName": "Bs Beverages",
    "ContactName": "Victoria Ashworth"
  }
]
```

### POST /webhook
Receives blockchain webhook notifications and stores them in the database.

**Example Request:**
```json
{
  "blockNumber": 12345,
  "transactionHash": "0xabc123def456",
  "from": "0x1234567890abcdef",
  "to": "0xfedcba0987654321",
  "value": "1000000000000000000"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Blockchain webhook received and stored for pamela",
  "webhookId": 1,
  "timestamp": "2026-02-15T11:47:00.000Z"
}
```

## Blockchain Integration

This project includes a blockchain webhook handler that can receive and store webhook notifications from Ethereum (ETH) and other blockchain networks.

**Looking for information about "Open ETH"?** See [BLOCKCHAIN_GUIDE.md](./BLOCKCHAIN_GUIDE.md) for detailed information about:

- What "Open ETH" means in different contexts
- OpenZeppelin Ethereum contracts
- How to use the blockchain webhook handler
- Getting started with Ethereum development

For webhook implementation details, see the unified worker at `src/index.ts`.
