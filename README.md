# d1-get-started

A Cloudflare Workers project that serves a small D1-backed API and a browser-based world clock page.

## Getting Started

### Prerequisites

- Node.js
- A Cloudflare account
- Wrangler CLI access through the project dependencies

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Validation

```bash
npm run build
npm test
npx tsc -p test/tsconfig.json --noEmit
```

### Deployment

```bash
npm run deploy
```

## Available Routes

- `/` returns the plain-text message `Pull container from cloud`.
- `/api/beverages` returns the `Bs Beverages` customer rows from the D1 database.
- `/clock` returns an HTML page that renders multiple time zones in the browser.

## API Authentication

Set the `API_KEY` Worker secret to require the `X-API-Key` header on `/api/*` routes.
