# GitHub Copilot Instructions

## Project Overview

This is a Cloudflare Workers project named "pamela" that demonstrates working with Cloudflare D1 database. The project is a starter template for building API endpoints that interact with D1 databases.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Language**: TypeScript
- **Build Tool**: Wrangler CLI
- **Testing**: Vitest with @cloudflare/vitest-pool-workers
- **Package Manager**: npm

## Project Structure

```
.
├── src/
│   └── index.ts           # Main worker code with fetch handler
├── test/
│   └── index.spec.ts      # Test suite using Vitest
├── schema.sql             # Database schema definition
├── wrangler.jsonc         # Wrangler configuration
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## Development Commands

- `npm install` - Install dependencies
- `npm run dev` - Start local development server
- `npm run test` - Run test suite with Vitest
- `npm run deploy` - Deploy to Cloudflare
- `npm run cf-typegen` - Generate TypeScript types from Wrangler config

## Code Style and Best Practices

### TypeScript
- Use TypeScript with strict type checking
- Use `satisfies ExportedHandler<Env>` for worker exports
- Leverage the auto-generated `worker-configuration.d.ts` for type definitions
- Use proper type annotations for function parameters and return types

### Cloudflare Workers Patterns
- Export a default object with a `fetch` method as the entry point
- Use `env` parameter to access bindings (D1 databases, KV, etc.)
- Handle errors gracefully with proper HTTP status codes
- Add appropriate cache headers for optimized performance

### Database Best Practices
- Use prepared statements with parameter binding for all queries (prevents SQL injection)
- Select only needed columns instead of `SELECT *` for better performance
- Use `env.DB.batch()` for multiple related operations
- Implement proper error handling for database operations
- Log database errors to console for debugging

### Code Examples

#### Good Database Query Pattern
```typescript
const { results } = await env.DB.prepare(
  "SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?"
)
  .bind("Bs Beverages")
  .all();
```

#### Good Error Handling Pattern
```typescript
try {
  // Database operation
} catch (error) {
  console.error("Database query failed:", error);
  return Response.json(
    { error: "Failed to fetch data" },
    { status: 500 }
  );
}
```

## Testing Requirements

- Write tests using Vitest framework
- Use both unit-style tests (with `createExecutionContext`) and integration-style tests (with `SELF.fetch`)
- Initialize test database in `beforeAll` hook
- Use `env.DB.batch()` for efficient test data setup
- Test both successful responses and error cases
- Verify response status codes, headers, and body content
- Use `toMatchInlineSnapshot()` for string comparisons when appropriate

### Test Example
```typescript
it('returns data from database', async () => {
  const response = await SELF.fetch('https://example.com/api/endpoint');
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});
```

## Git Workflow

- Make small, focused commits with descriptive messages
- Run tests before committing changes
- Ensure code builds successfully with `npm run dev`

## Security and Boundaries

### Required
- **ALWAYS** use prepared statements with parameter binding for database queries
- **NEVER** commit secrets, API keys, or credentials to the repository
- **NEVER** use string concatenation for SQL queries (SQL injection risk)
- Validate and sanitize user inputs
- Return appropriate error messages without exposing internal implementation details

### Prohibited
- Do not modify the database configuration in `wrangler.jsonc` without explicit permission
- Do not change the database schema without updating `schema.sql`
- Do not remove or modify existing tests without justification
- Do not add new dependencies without security review
- Do not expose sensitive database information in error messages

## Performance Optimization

- Add caching headers (`Cache-Control`) for cacheable responses
- Use column selection instead of `SELECT *`
- Batch database operations when possible
- Consider edge caching for static responses

## When Making Changes

1. **Understand the context**: Review related code before making changes
2. **Test locally**: Use `npm run dev` to test changes locally
3. **Run tests**: Execute `npm run test` to verify nothing breaks
4. **Minimal changes**: Make the smallest possible change to achieve the goal
5. **Document**: Update comments and documentation if behavior changes
6. **Security check**: Verify no security vulnerabilities are introduced

## Common Tasks

### Adding a New API Endpoint
1. Add a new route handler in `src/index.ts`
2. Implement the database query with prepared statements
3. Add error handling
4. Write tests in `test/index.spec.ts`
5. Run tests to verify

### Modifying Database Schema
1. Update `schema.sql` with the changes
2. Update TypeScript types if needed
3. Update queries in `src/index.ts`
4. Update tests to match new schema
5. Test locally before deploying

### Adding Dependencies
1. Check if the dependency is compatible with Cloudflare Workers
2. Use `npm install <package>` to add it
3. Verify it doesn't increase bundle size significantly
4. Update documentation if needed
