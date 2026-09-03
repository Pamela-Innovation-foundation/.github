# AGENTS.md

> Instructions for AI coding agents working on this repository.

## Project Overview

**pamela** is a Cloudflare Workers project that demonstrates working with D1 database (Cloudflare's serverless SQL database). This starter template provides examples of database integration, blockchain webhook handling, and data structure implementations in TypeScript.

- **Runtime**: Cloudflare Workers (edge computing)
- **Database**: Cloudflare D1 (serverless SQLite-compatible SQL)
- **Language**: TypeScript (strict mode)
- **Node Version**: >=20.18.1

## Setup

```bash
npm install
```

## Development Commands

```bash
npm run dev      # Start local development server (Wrangler)
npm test         # Run Vitest tests
npm run lint     # Check code with ESLint
npm run format   # Format code with Prettier
npm run build    # Type-check with TypeScript compiler
npm run deploy   # Deploy to Cloudflare Workers
```

Before deploying, set the required API key secret:

```bash
wrangler secret put API_KEY
```

## Project Structure

```
/src/
  index.ts              - Main Worker entry point (fetch handler, routes)
  blockchain-webhook.js - Webhook handler for blockchain events
  binary-search-tree.ts - Binary Search Tree data structure
  bst-example.ts        - BST usage examples
/test/
  *.spec.ts             - Vitest test files
schema.sql              - D1 database schema and seed data
wrangler.jsonc          - Wrangler configuration (bindings, compatibility)
worker-configuration.d.ts - Auto-generated Worker environment types
```

## Code Conventions

- **Indentation**: 2 spaces, no tabs
- **Quotes**: Double quotes (`"`)
- **Semicolons**: Required
- **Line width**: 80 characters max
- **TypeScript**: Strict mode enabled — no implicit `any`
- **Naming**: camelCase for variables/functions, PascalCase for types/interfaces, UPPER_SNAKE_CASE for module-level constants
- **Unused vars**: Prefix with `_` (e.g., `_unused`) to satisfy the linter

Export Workers using the `satisfies` operator:

```typescript
export default {
  async fetch(request, env): Promise<Response> {
    // ...
  },
} satisfies ExportedHandler<Env>;
```

## Database (D1) Patterns

**Always use prepared statements with `.bind()`** — never interpolate user input directly into SQL:

```typescript
// ✅ Safe
const { results } = await env.DB.prepare(
  "SELECT CustomerId, CompanyName FROM Customers WHERE CompanyName = ?"
).bind("Bs Beverages").all();

// ❌ SQL injection risk — never do this
const { results } = await env.DB.prepare(
  `SELECT * FROM Customers WHERE name = '${userInput}'`
).all();
```

- Select only the columns you need (avoid `SELECT *`).
- Use `.batch()` for multiple writes in tests.
- Wrap queries in `try/catch` and return a `500` response on failure.

## API Security

All routes under `/api/` are protected by an API key:

- The key is stored as a Wrangler secret (`API_KEY`).
- Clients must supply the `X-API-Key` header.
- Missing or invalid keys receive a `401 Unauthorized` response.

## Testing

Tests live in `/test/` and use **Vitest** with the `@cloudflare/vitest-pool-workers` pool, which provides an isolated D1 instance per run.

```typescript
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

describe("My feature", () => {
  beforeAll(async () => {
    // Seed the isolated D1 instance
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)"),
    ]);
  });

  it("returns 200", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "test-key" },
    });
    expect(response.status).toBe(200);
  });
});
```

Run only the relevant spec while iterating:

```bash
npm test -- test/index.spec.ts
```

## Adding a New Endpoint

1. Add a route in `src/index.ts` following the existing `if (pathname === "...")` pattern.
2. Use a prepared statement with `.bind()` for any DB access.
3. Wrap in `try/catch`; return `Response.json({ error: "..." }, { status: 500 })` on failure.
4. Add cache headers (`Cache-Control`) for read-only responses.
5. Write a corresponding test in `/test/`.

## Database Schema

### Customers
```sql
CREATE TABLE Customers (
  CustomerId INTEGER PRIMARY KEY,
  CompanyName TEXT,
  ContactName TEXT
);
```

### BlockchainWebhooks
```sql
CREATE TABLE BlockchainWebhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
```

To apply schema changes locally or remotely:

```bash
wrangler d1 execute DB --file=schema.sql          # local
wrangler d1 execute DB --file=schema.sql --remote  # production
```

## Before Committing

1. `npm run format` — fix code style
2. `npm run lint` — catch linting errors
3. `npm run build` — verify TypeScript compiles
4. `npm test` — ensure all tests pass
