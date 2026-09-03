# d1-get-started

A Cloudflare Workers project demonstrating integration with Cloudflare D1 database, featuring customer data management and blockchain webhook handling.

## Overview

This project showcases how to build serverless APIs with Cloudflare Workers and D1 (Cloudflare's SQL database). It includes two main functionalities:

1. **Customer Data API** - Query and retrieve customer information from a D1 database
2. **Blockchain Webhook Handler** - Receive and store blockchain webhook events

The project includes performance optimizations such as explicit column selection, response caching, proper error handling, and comprehensive test coverage.

## Features

- 🚀 **Serverless Architecture** - Built on Cloudflare Workers for global edge deployment
- 💾 **D1 Database Integration** - SQL database with automatic scaling
- 🔗 **RESTful API Endpoints** - Query customers and handle webhook events
- ⚡ **Performance Optimized** - Includes caching, explicit column selection, and efficient queries
- ✅ **Comprehensive Testing** - Full test suite using Vitest with unit and integration tests
- 🛠️ **TypeScript Support** - Type-safe development with TypeScript
- 🎨 **Code Quality Tools** - ESLint, Prettier, and automated formatting
- 📊 **Error Handling** - Robust error handling with proper HTTP status codes

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher)
- **npm** or **yarn**
- **Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI** - Cloudflare's command-line tool (included in dev dependencies)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Pjrich1313/d1-get-started.git
   cd d1-get-started
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Authenticate with Cloudflare:**
   ```bash
   npx wrangler login
   ```

## Database Setup

### Local Development

The database schema is defined in `schema.sql` and includes two tables:

- **Customers** - Sample customer data
- **BlockchainWebhooks** - Storage for webhook events

To initialize your local D1 database:

```bash
# Create the database locally
npx wrangler d1 execute DB --local --file=schema.sql
```

### Production Database

For production, the database is automatically initialized after deployment using the `postdeploy` script:

```bash
npm run deploy
# Automatically runs: wrangler d1 execute DB --file=schema.sql --remote
```

You can also manually execute the schema:

```bash
npx wrangler d1 execute DB --file=schema.sql --remote
```

## Development

### Start the Development Server

Run the Worker locally with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:8787`

### Available Scripts

- **`npm run dev`** - Start local development server with hot-reload
- **`npm run build`** - Type-check TypeScript code
- **`npm test`** - Run test suite with Vitest
- **`npm run lint`** - Lint TypeScript code with ESLint
- **`npm run lint:fix`** - Auto-fix linting issues
- **`npm run format`** - Format code with Prettier
- **`npm run format:check`** - Check code formatting
- **`npm run deploy`** - Deploy to Cloudflare Workers
- **`npm run cf-typegen`** - Generate TypeScript types for Cloudflare bindings

## API Endpoints

### 1. Root Endpoint

**GET /**

Returns a welcome message with API usage instructions.

```bash
curl http://localhost:8787/
```

**Response:**

```
Call /api/beverages to see everyone who works at Bs Beverages
```

### 2. Beverages API

**GET /api/beverages**

Retrieves all customers from "Bs Beverages" company.

```bash
curl http://localhost:8787/api/beverages
```

**Response:**

```json
[
  {
    "CustomerId": 11,
    "CompanyName": "Bs Beverages",
    "ContactName": "Victoria Ashworth"
  },
  {
    "CustomerId": 13,
    "CompanyName": "Bs Beverages",
    "ContactName": "Random Name"
  }
]
```

**Features:**

- Response caching (60 seconds)
- Explicit column selection for performance
- Error handling with proper status codes

### 3. Blockchain Webhook

**POST /webhook**

Receives and stores blockchain webhook data.

```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "blockNumber": 12345,
    "transactionHash": "0xabc123...",
    "event": "Transfer"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Blockchain webhook received and stored for pamela",
  "webhookId": 1,
  "timestamp": "2026-02-05T00:59:23.399Z"
}
```

**Error Response (Method Not Allowed):**

```bash
curl -X GET http://localhost:8787/webhook
```

```json
{
  "error": "Method not allowed. Only POST requests are accepted."
}
```

## Testing

The project includes comprehensive tests using Vitest and Cloudflare's Vitest pool for Workers.

### Run Tests

```bash
npm test
```

### Test Coverage

The test suite includes:

- **Unit tests** - Test individual Worker functions with mocked execution context
- **Integration tests** - End-to-end tests using the `SELF` fetch interface
- **Database tests** - Validate database operations and query results
- **Error handling tests** - Ensure proper error responses

Test files are located in the `test/` directory:

- `test/index.spec.ts` - Tests for the customer API
- `test/blockchain-webhook.spec.ts` - Tests for webhook handling

## Deployment

### Deploy to Cloudflare Workers

```bash
npm run deploy
```

This command will:

1. Deploy your Worker to Cloudflare's global network
2. Automatically run the database schema initialization (via `postdeploy` script)

### Post-Deployment

After deployment, your Worker will be available at:

```
https://d1-get-started.<your-subdomain>.workers.dev
```

You can find the exact URL in the Wrangler output or in your Cloudflare dashboard.

### Environment Configuration

The Worker configuration is managed in `wrangler.jsonc`:

- **D1 Database Binding** - `DB` binding connected to `prod-d1-tutorial`
- **Compatibility Date** - `2025-04-30`
- **Observability** - Enabled for monitoring and logging

## Project Structure

```
d1-get-started/
├── src/
│   ├── index.ts                  # Main Worker with Customers API
│   └── blockchain-webhook.js     # Blockchain webhook handler
├── test/
│   ├── index.spec.ts             # Tests for main Worker
│   ├── blockchain-webhook.spec.ts # Tests for webhook handler
│   ├── env.d.ts                  # Test environment types
│   └── tsconfig.json             # Test TypeScript config
├── schema.sql                     # D1 database schema
├── wrangler.jsonc                # Cloudflare Worker configuration
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.mts             # Vitest test configuration
├── eslint.config.mjs             # ESLint configuration
├── .prettierrc.json              # Prettier configuration
├── PERFORMANCE_OPTIMIZATIONS.md  # Detailed performance documentation
└── README.md                     # This file
```

## Performance Optimizations

This project includes several performance optimizations:

1. **Explicit Column Selection** - Only fetch required columns instead of `SELECT *`
2. **Response Caching** - 60-second cache headers for improved response times
3. **Error Handling** - Graceful error handling prevents Worker crashes
4. **Batch Operations** - Efficient database batch inserts in tests

For detailed information, see [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)

## Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Language**: TypeScript
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **CLI Tool**: Wrangler 4.x
- **Code Quality**: ESLint, Prettier
- **Package Manager**: npm

## Contributing

When contributing to this project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Format code: `npm run format`
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

## License

This project is for educational and demonstration purposes.

## Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/Pjrich1313/d1-get-started).
