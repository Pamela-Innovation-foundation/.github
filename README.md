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

### CI/CD Setup

This project includes a GitHub Actions workflow for automatic deployment to Cloudflare Workers.

#### Setting up Cloudflare API Token

1. **Generate a Cloudflare API Token:**
   - Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to "My Profile" > "API Tokens"
   - Click "Create Token"
   - Use the "Edit Cloudflare Workers" template
   - Select your account (no zone selection needed)
   - Create the token and copy it

2. **Add Secrets to GitHub:**
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `CLOUDFLARE_API_TOKEN`: Your API token from step 1
     - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in the dashboard overview)

3. **Deploy:**
   - Push to the `main` branch to trigger automatic deployment
   - The workflow will deploy your Worker to Cloudflare

## About pamela

pamela demonstrates the basics of working with Cloudflare D1 database in a Workers environment.
