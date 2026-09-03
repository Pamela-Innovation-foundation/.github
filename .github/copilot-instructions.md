# Copilot Instructions for d1-get-started (pamela)

## Project Overview

This is a Cloudflare Workers project named "pamela" that demonstrates working with D1 database (Cloudflare's SQLite database). The project serves as a starter template for building serverless applications with database integration.

### Key Features

- **D1 Database Integration**: SQLite database operations using Cloudflare's D1
- **Blockchain Webhooks**: Receive and process blockchain events from Ethereum and other networks
- **Binary Search Tree**: Example data structure implementation in TypeScript
- **MCP Server Support**: Model Context Protocol (MCP) integration for AI tools

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript 5.5+
- **Node Version**: >= 20.18.1
- **Database**: Cloudflare D1 (SQLite)
- **Testing**: Vitest with Cloudflare Workers pool
- **Linting**: ESLint 9.x with TypeScript support
- **Formatting**: Prettier 3.x
- **Build Tool**: Wrangler 4.x

## Development Workflow

### Building

```bash
npm run build  # Type check with TypeScript (no emit)
```

### Testing

```bash
npm test  # Run tests with Vitest
```

### Linting

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
```

### Formatting

```bash
npm run format:check  # Check formatting
npm run format        # Auto-format code
```

### Local Development

```bash
npm run dev   # Start local development server with Wrangler
```

### Deployment

```bash
npm run deploy  # Deploy to Cloudflare Workers
```

## Code Standards and Conventions

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Avoid using `any` type - use `unknown` or proper types instead
- Use proper type imports from `@cloudflare/workers-types`

### Code Style

- Follow existing Prettier configuration (`.prettierrc.json`)
- Use ESLint rules defined in `eslint.config.mjs`
- Run `npm run format` before committing
- Ensure `npm run lint` passes

### File Organization

- Source code: `src/`
- Tests: `test/`
- Database schema: `schema.sql`
- Configuration: Root level (`wrangler.jsonc`, `tsconfig.json`, etc.)

## Project Structure

### Source Files (`src/`)

- `index.ts`: Main Workers entry point
- `blockchain-webhook.js`: Blockchain webhook handler
- `binary-search-tree.ts`: BST data structure implementation
- `bst-example.ts`: Example usage of BST

### Documentation

- `README.md`: Main project documentation
- `BLOCKCHAIN_GUIDE.md`: Detailed blockchain integration guide
- `BST_README.md`: Binary search tree documentation
- `PERFORMANCE_OPTIMIZATIONS.md`: Performance tips and optimizations

## Rules and Restrictions

### DO:

- Write type-safe TypeScript code
- Add tests for new functionality using Vitest
- Follow the existing code patterns and structure
- Update documentation when adding new features
- Run linting and formatting before committing
- Use environment variables for sensitive configuration
- Handle errors gracefully in Workers environment

### DON'T:

- Don't commit secrets or API keys
- Don't modify `node_modules/` or generated files
- Don't use `any` type in TypeScript
- Don't skip type checking with `@ts-ignore` without good reason
- Don't break existing tests
- Don't remove or modify production configuration without careful review
- Don't deploy without testing locally first

## Database Operations

- Database binding is accessed via `env.DB` in Workers
- Schema is defined in `schema.sql`
- Use prepared statements for all queries to prevent SQL injection
- Test database operations locally with `wrangler dev`

## Testing Guidelines

- Write tests in the `test/` directory
- Use Vitest with `@cloudflare/vitest-pool-workers`
- Test both success and error cases
- Mock external dependencies appropriately
- Ensure tests can run in isolation

## Blockchain Integration

- Webhook handler is in `src/blockchain-webhook.js`
- See `BLOCKCHAIN_GUIDE.md` for detailed information
- Handle webhook verification and signature validation
- Store webhook data in D1 database

## MCP Server Integration

This project is configured for Model Context Protocol (MCP) in `.devcontainer/devcontainer.json`:

- Filesystem server for file access
- GitHub server for repository integration
- Requires `GITHUB_TOKEN` environment variable for GitHub MCP server

## Common Tasks

### Adding a new endpoint

1. Update `src/index.ts` with new route
2. Add TypeScript types for request/response
3. Add tests in `test/` directory
4. Update documentation if needed
5. Test locally with `npm run dev`
6. Run `npm run lint` and `npm run format`

### Updating database schema

1. Modify `schema.sql`
2. Test locally first
3. Deploy changes with `npm run deploy` (runs `postdeploy` script)
4. Update TypeScript types if needed

### Adding dependencies

1. Use `npm install <package>` for runtime dependencies
2. Use `npm install -D <package>` for dev dependencies
3. Ensure compatibility with Cloudflare Workers
4. Update documentation if it affects setup

## Issue and PR Guidelines

When working on issues:

- Read the issue description carefully
- Ask for clarification if requirements are unclear
- Make minimal, focused changes
- Write tests to verify your changes
- Update documentation as needed
- Follow the commit message conventions
- Request review before merging

## Security Considerations

- Never commit sensitive data (API keys, tokens, secrets)
- Validate all user input
- Use prepared statements for database queries
- Follow Cloudflare Workers security best practices
- Review changes for security implications before deploying
