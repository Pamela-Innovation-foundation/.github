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

## API Endpoints

### GET /api/beverages
Returns all customers from Bs Beverages company.

**Response:**
```json
[
  {
    "CustomerId": 11,
    "CompanyName": "Bs Beverages",
    "ContactName": "Victoria Ashworth"
  }
]
```

### GET /api/customers/open
Returns all customers with 'open' status.

**Response:**
```json
[
  {
    "CustomerId": 1,
    "CompanyName": "Alfreds Futterkiste",
    "ContactName": "Maria Anders",
    "Status": "open"
  }
]
```
