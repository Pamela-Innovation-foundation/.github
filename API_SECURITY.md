# API Security Guide

This guide explains how to set up API key authentication for the Cloudflare Worker and configure branch protection for CI/CD security.

## API Key Authentication

The Cloudflare Worker uses API key authentication to protect API endpoints. All requests to endpoints starting with `/api/` require a valid API key passed in the `X-API-Key` header.

### Setting Up the API Key

#### 1. Generate a Strong API Key

Generate a secure random API key using one of these methods:

```bash
# Using OpenSSL (recommended)
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### 2. Store the API Key as a Wrangler Secret

Secrets are encrypted environment variables that are securely stored by Cloudflare. Never commit secrets to your repository.

**For local development:**

```bash
wrangler secret put API_KEY
```

When prompted, paste your generated API key.

**For production:**

```bash
wrangler secret put API_KEY --env production
```

**Note**: Secrets are environment-specific. If you have multiple environments (staging, production), you'll need to set the secret for each environment.

#### 3. Verify the Secret

You can list (but not view) your secrets:

```bash
wrangler secret list
```

#### 4. Test the Authentication

Once deployed, test your API with and without the API key:

**Without API key (should fail with 401):**

```bash
curl https://your-worker.your-subdomain.workers.dev/api/beverages
```

**With valid API key (should succeed with 200):**

```bash
curl -H "X-API-Key: your-api-key-here" \
  https://your-worker.your-subdomain.workers.dev/api/beverages
```

### Rotating API Keys

To rotate your API key:

1. Generate a new API key using the methods above
2. Update the secret: `wrangler secret put API_KEY`
3. Update any clients or services using the old API key
4. Monitor logs to ensure no requests are failing with 401 errors

### Best Practices

- **Never commit API keys to version control**
- Use different API keys for different environments (development, staging, production)
- Rotate API keys periodically (e.g., every 90 days)
- Use strong, randomly generated keys (at least 32 bytes)
- Monitor failed authentication attempts in your Worker logs
- Consider implementing rate limiting for additional security
- For production systems, consider using more advanced authentication like OAuth2 or JWT

### Security Considerations

The current implementation provides basic API key authentication. For production systems with higher security requirements, consider:

- **Rate Limiting**: Implement rate limiting to prevent brute force attacks
- **IP Allowlisting**: Restrict access to specific IP addresses or ranges
- **API Key Scoping**: Use different API keys with different permissions
- **Audit Logging**: Log all API access for security monitoring
- **Key Expiration**: Implement automatic key expiration and rotation
- **Multi-factor Authentication**: For administrative endpoints

## Branch Protection for CI/CD

Branch protection rules help maintain code quality and security by requiring checks to pass before merging changes.

### Why Branch Protection Matters

- Prevents direct commits to production branches
- Ensures all code passes tests and security scans before merging
- Requires code review before changes are accepted
- Protects against accidental or malicious changes

### Setting Up Branch Protection on GitHub

#### 1. Navigate to Branch Protection Settings

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule**

#### 2. Configure Protection Rules

**Branch name pattern:** `main` (or your production branch)

**Recommended settings:**

- ✅ **Require a pull request before merging**
  - Require approvals: 1 (or more for production)
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners (if using CODEOWNERS file)

- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - Status checks to require:
    - `build` (TypeScript compilation)
    - `test` (Vitest tests)
    - `lint` (ESLint)
    - `codeql` (Security scanning, if enabled)

- ✅ **Require conversation resolution before merging**
  - All PR comments must be resolved before merging

- ✅ **Require signed commits** (recommended for high-security projects)

- ✅ **Include administrators**
  - Apply rules to repository administrators as well

- ✅ **Restrict who can push to matching branches**
  - Only allow specific users or teams to push directly

- ✅ **Allow force pushes**: Disabled
- ✅ **Allow deletions**: Disabled

#### 3. Save Changes

Click **Create** or **Save changes** to apply the branch protection rules.

### Setting Up GitHub Actions for CI/CD

Create a `.github/workflows/ci.yml` file to automate testing:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run CodeQL Analysis
        uses: github/codeql-action/init@v3
        with:
          languages: typescript
      - uses: github/codeql-action/analyze@v3
```

### Environment-Specific Secrets

For different environments (preview, staging, production), use GitHub environment secrets:

1. Go to **Settings** → **Environments**
2. Create environments: `preview`, `staging`, `production`
3. For each environment:
   - Add environment-specific secrets (e.g., `API_KEY`)
   - Configure protection rules (e.g., require approval for production)

### Deployment Workflow

Create `.github/workflows/deploy.yml` for automated deployments:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        # Secrets are managed via Wrangler CLI, not GitHub Actions
```

### Testing Branch Protection

After setting up branch protection:

1. Create a new branch: `git checkout -b test-branch-protection`
2. Make a small change and commit it
3. Push the branch: `git push origin test-branch-protection`
4. Try to push directly to main: `git push origin test-branch-protection:main`
   - This should fail with a branch protection error
5. Create a pull request instead and verify:
   - All status checks run
   - Approval is required (if configured)
   - Direct push to main is blocked

## Additional Resources

- [Cloudflare Workers Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions for CI/CD](https://docs.github.com/en/actions)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
