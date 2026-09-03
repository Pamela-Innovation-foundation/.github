# GitHub Copilot Instructions for d1-get-started

## Project Overview

**pamela** is a Cloudflare Workers project that demonstrates working with D1 database (Cloudflare's serverless SQL database). This starter template provides examples of database integration, blockchain webhook handling, and data structure implementations in TypeScript.

**Purpose**: Educational template for developers learning Cloudflare D1 and Workers
**Audience**: Developers building serverless applications with Cloudflare Workers and D1 database

## Tech Stack

### Core Technologies

- **Runtime**: Cloudflare Workers (edge computing platform)
- **Database**: Cloudflare D1 (serverless SQL database)
- **Language**: TypeScript (strict mode enabled)
- **Module System**: ES2022 modules
- **Target**: ES2021

### Development Tools

- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Vitest with @cloudflare/vitest-pool-workers
- **Linting**: ESLint with TypeScript ESLint plugin
- **Formatting**: Prettier
- **Deployment**: Wrangler CLI (v4.62.0+)
- **Node Version**: >=20.18.1

### Key Dependencies

- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `wrangler` - Cloudflare Workers CLI and development server

## Project Structure

```
/src/
  index.ts              - Main Worker entry point with fetch handler
  blockchain-webhook.js - Webhook handler for blockchain events
  binary-search-tree.ts - Binary Search Tree implementation
  bst-example.ts        - BST usage examples
/test/
  *.spec.ts            - Vitest test files
schema.sql             - D1 database schema and seed data
wrangler.jsonc         - Wrangler configuration
```

## Coding Conventions

### TypeScript Style

- **Strict mode**: Always enabled (`"strict": true` in tsconfig.json)
- **Semicolons**: Required (enforced by Prettier)
- **Quotes**: Double quotes for strings (enforced by Prettier)
- **Indentation**: 2 spaces, no tabs
- **Line width**: 80 characters maximum
- **Trailing commas**: ES5 style (no trailing comma on last item)

### Naming Conventions

- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Types/Interfaces**: PascalCase
- **Functions**: camelCase
- **Unused variables**: Prefix with underscore (`_variableName`) to avoid linting errors

### TypeScript Rules

- Avoid `any` type - prefer explicit typing (warns on `@typescript-eslint/no-explicit-any`)
- Explicit function return types are optional but encouraged for public APIs
- Unused variables must be prefixed with `_` or removed
- Use satisfies operator for type checking (e.g., `satisfies ExportedHandler<Env>`)

## Code Patterns and Best Practices

### Worker Structure

All Workers must export a default object with a `fetch` handler:

```typescript
export default {
  async fetch(request, env): Promise<Response> {
    // Handler logic
  },
} satisfies ExportedHandler<Env>;
```

### D1 Database Queries

**Always use prepared statements with parameter binding**:

```typescript
// Good - prevents SQL injection
const { results } = await env.DB.prepare(
  "SELECT CustomerId, CompanyName FROM Customers WHERE CompanyName = ?"
)
  .bind("Bs Beverages")
  .all();

// Bad - SQL injection vulnerability
const { results } = await env.DB.prepare(
  `SELECT * FROM Customers WHERE CompanyName = '${userInput}'`
).all();
```

**Performance optimization tips**:

- Select only needed columns instead of `SELECT *`
- Use `.batch()` for multiple inserts/updates in tests
- Add appropriate indexes for frequently queried columns
- Include cache headers for cacheable responses

**Error handling**:

```typescript
try {
  const { results } = await env.DB.prepare(query).bind(param).all();
  return Response.json(results);
} catch (error) {
  console.error("Database query failed:", error);
  return Response.json({ error: "Failed to fetch data" }, { status: 500 });
}
```

### Response Patterns

**JSON responses with headers**:

```typescript
return Response.json(data, {
  headers: {
    "Cache-Control": "public, max-age=60",
  },
});
```

**Error responses**:

```typescript
return Response.json({ error: "Error message" }, { status: 500 });
```

### Testing Patterns

**Use Vitest with Cloudflare Workers pool**:

```typescript
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

describe("Feature tests", () => {
  beforeAll(async () => {
    // Setup test database
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS ...`);
  });

  // Unit style test
  it("unit test example", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

  // Integration style test (preferred for simplicity)
  it("integration test example", async () => {
    const response = await SELF.fetch("https://example.com/api/endpoint");
    expect(response.status).toBe(200);
  });
});
```

**Use `beforeAll` to initialize test data with `batch()` for performance**:

```typescript
await env.DB.batch([
  env.DB.prepare("INSERT INTO Customers VALUES (?, ?, ?)").bind(
    1,
    "Name1",
    "Contact1"
  ),
  env.DB.prepare("INSERT INTO Customers VALUES (?, ?, ?)").bind(
    2,
    "Name2",
    "Contact2"
  ),
]);
```

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

## Security Best Practices

### Input Validation

- Always validate and sanitize user input before database queries
- Use prepared statements with parameter binding (NEVER string concatenation)
- Validate request methods and paths before processing

### Error Handling

- Log errors with `console.error()` for debugging
- Never expose sensitive error details in responses to clients
- Return generic error messages to users

### Secrets Management

- Use Wrangler secrets for sensitive data (`wrangler secret put SECRET_NAME`)
- Never commit secrets to version control
- Access secrets via `env` object in Workers

### SQL Injection Prevention

```typescript
// Secure - use .bind() for parameters
await env.DB.prepare("SELECT * FROM Users WHERE id = ?").bind(userId).first();

// Insecure - NEVER do this
await env.DB.prepare(`SELECT * FROM Users WHERE id = ${userId}`).first();
```

## Development Workflow

### Local Development

```bash
npm run dev        # Start local development server with Wrangler
npm test           # Run Vitest tests
npm run lint       # Check code with ESLint
npm run format     # Format code with Prettier
npm run build      # Type-check with TypeScript
```

### Before Committing

1. Run `npm run format` to ensure consistent code style
2. Run `npm run lint` to catch potential issues
3. Run `npm run build` to verify TypeScript compilation
4. Run `npm test` to ensure all tests pass

### Deployment

```bash
npm run deploy     # Deploy to Cloudflare Workers
```

The `postdeploy` script automatically runs database migrations.

## Common Pitfalls and Solutions

### Issue: D1 database not initialized

**Solution**: Run schema migrations: `wrangler d1 execute DB --file=schema.sql --remote`

### Issue: TypeScript errors with Worker types

**Solution**: Ensure `@cloudflare/workers-types` version matches compatibility_date in wrangler.jsonc

### Issue: Tests failing with database errors

**Solution**: Tests run with isolated D1 instances - initialize schema in `beforeAll()`

### Issue: Module resolution errors

**Solution**: Use `moduleResolution: "Bundler"` in tsconfig.json (already configured)

## Examples

### Adding a New API Endpoint

```typescript
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/new-endpoint") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT column FROM table WHERE condition = ?"
        )
          .bind(value)
          .all();

        return Response.json(results, {
          headers: { "Cache-Control": "public, max-age=60" },
        });
      } catch (error) {
        console.error("Query failed:", error);
        return Response.json(
          { error: "Failed to fetch data" },
          { status: 500 }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

### Adding Tests for New Endpoint

```typescript
describe("New endpoint", () => {
  it("returns data successfully", async () => {
    const response = await SELF.fetch("https://example.com/api/new-endpoint");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("handles errors gracefully", async () => {
    // Test error conditions
  });
});
```

## Model Context Protocol (MCP)

This project is configured with MCP servers for AI tool integration:

- Filesystem server for code access
- GitHub server for repository integration (requires `GITHUB_TOKEN`)

Configuration is in `.devcontainer/devcontainer.json`.

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Vitest Documentation](https://vitest.dev/)

## Questions to Ask

When implementing new features, consider:

1. Does this require a new database table or column?
2. Are all database queries using prepared statements with `.bind()`?
3. Have I added appropriate error handling?
4. Are there tests covering both success and error cases?
5. Should this response be cached? If so, what's the appropriate cache duration?
6. Have I validated all user inputs?
7. Does this follow the existing code patterns in the project?
