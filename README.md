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

## API Endpoints

### GET /api/beverages
Returns all customers from "Bs Beverages" company.

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

### POST /api/pull
Refreshes the database by re-initializing it with schema data. Useful for resetting the database to its initial state.

**⚠️ Warning:** This endpoint drops and recreates the database, causing data loss. It is intended for development and testing purposes only. In production environments, this endpoint should be protected with authentication or disabled entirely.

**Example Response:**
```json
{
  "success": true,
  "message": "Database refreshed successfully"
}
```

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.
