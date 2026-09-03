# Upgrade and Migration

This guide covers upgrading your d1-get-started Cloudflare Workers application and migrating between environments.

## Table of Contents

- [Identifying Your Current Version](#identifying-your-current-version)
- [Backup Procedures](#backup-procedures)
- [Upgrading Your Worker](#upgrading-your-worker)
- [Database Schema Migrations](#database-schema-migrations)
- [Migration Between Environments](#migration-between-environments)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Identifying Your Current Version

Before upgrading, identify your current deployment version:

### Check Worker Version
```bash
# View your current deployment
wrangler deployments list

# Check package.json for dependency versions
cat package.json
```

### Check D1 Database Version
```bash
# List your D1 databases
wrangler d1 list

# Get info about your database
wrangler d1 info DB
```

## Backup Procedures

**Always backup your data before upgrading or migrating.**

### Backup D1 Database

#### Export Database to SQL File
```bash
# Export production database
wrangler d1 export DB --remote --output=backup-$(date +%Y%m%d-%H%M%S).sql

# Export local development database
wrangler d1 export DB --local --output=backup-local-$(date +%Y%m%d-%H%M%S).sql
```

#### Backup Worker Configuration
```bash
# Backup your wrangler configuration
cp wrangler.jsonc wrangler.jsonc.backup

# Backup environment variables (if using .dev.vars)
cp .dev.vars .dev.vars.backup 2>/dev/null || echo "No .dev.vars file"

# Create a complete backup
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  wrangler.jsonc \
  package.json \
  package-lock.json \
  src/ \
  schema.sql \
  .dev.vars 2>/dev/null || true
```

## Upgrading Your Worker

### Method 1: Upgrading Dependencies (Recommended)

1. **Update Node.js packages:**
   ```bash
   # Update to latest compatible versions
   npm update
   
   # Or update to latest versions (may include breaking changes)
   npm install @cloudflare/workers-types@latest \
     @cloudflare/vitest-pool-workers@latest \
     wrangler@latest \
     typescript@latest \
     vitest@latest
   ```

2. **Update Wrangler types:**
   ```bash
   npm run cf-typegen
   ```

3. **Test your changes:**
   ```bash
   # Run tests
   npm test
   
   # Test locally
   npm run dev
   ```

4. **Deploy the upgrade:**
   ```bash
   npm run deploy
   ```

### Method 2: Upgrading via Git (if using version control)

1. **Pull latest changes:**
   ```bash
   git fetch origin
   git pull origin main
   ```

2. **Install updated dependencies:**
   ```bash
   npm install
   ```

3. **Update types and test:**
   ```bash
   npm run cf-typegen
   npm test
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

### Method 3: Fresh Installation

For major version upgrades, you may want to start fresh:

1. **Backup your data** (see [Backup Procedures](#backup-procedures))

2. **Create a new project:**
   ```bash
   npm create cloudflare@latest my-new-d1-app
   cd my-new-d1-app
   ```

3. **Migrate your code:**
   - Copy your `src/` directory
   - Copy your `schema.sql`
   - Update `wrangler.jsonc` with your D1 database bindings
   - Copy any custom configuration

4. **Restore your database:**
   ```bash
   wrangler d1 execute DB --file=backup-YYYYMMDD-HHMMSS.sql --remote
   ```

## Database Schema Migrations

### Adding New Tables or Columns

1. **Create migration SQL file:**
   ```sql
   -- migration-001-add-users.sql
   CREATE TABLE IF NOT EXISTS Users (
     UserId INTEGER PRIMARY KEY AUTOINCREMENT,
     Username TEXT NOT NULL,
     Email TEXT NOT NULL,
     CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Test migration locally:**
   ```bash
   wrangler d1 execute DB --file=migration-001-add-users.sql --local
   
   # Verify the changes
   wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table';" --local
   ```

3. **Apply migration to production:**
   ```bash
   wrangler d1 execute DB --file=migration-001-add-users.sql --remote
   ```

### Modifying Existing Schema

SQLite (D1) doesn't support all ALTER TABLE operations. For complex changes:

1. **Create a new table with desired schema:**
   ```sql
   CREATE TABLE Customers_new (
     CustomerId INTEGER PRIMARY KEY,
     CompanyName TEXT NOT NULL,
     ContactName TEXT,
     Email TEXT,  -- New column
     CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Copy data from old table:**
   ```sql
   INSERT INTO Customers_new (CustomerId, CompanyName, ContactName)
   SELECT CustomerId, CompanyName, ContactName FROM Customers;
   ```

3. **Drop old table and rename:**
   ```sql
   DROP TABLE Customers;
   ALTER TABLE Customers_new RENAME TO Customers;
   ```

4. **Apply the migration:**
   ```bash
   wrangler d1 execute DB --file=migration-002-modify-customers.sql --remote
   ```

### Best Practices for Migrations

- **Always test migrations locally first** using `--local` flag
- **Use transactions** for multi-step migrations
- **Keep migration files** in version control (e.g., `migrations/` directory)
- **Version your migrations** (e.g., `001-initial.sql`, `002-add-users.sql`)
- **Never modify old migration files** once they've been applied to production

## Migration Between Environments

### From Local to Production

1. **Ensure your local database is up to date:**
   ```bash
   wrangler d1 execute DB --file=schema.sql --local
   ```

2. **Test locally:**
   ```bash
   npm run dev
   npm test
   ```

3. **Deploy to production:**
   ```bash
   npm run deploy
   ```
   
   This automatically runs the `postdeploy` script which applies schema.sql to production.

### Creating Staging Environment

1. **Create a new D1 database for staging:**
   ```bash
   wrangler d1 create staging-d1-tutorial
   ```

2. **Update `wrangler.jsonc` with environment-specific configuration:**
   ```json
   {
     "name": "d1-get-started",
     "main": "src/index.ts",
     "compatibility_date": "2025-04-30",
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "prod-d1-tutorial",
         "database_id": "your-prod-database-id"
       }
     ],
     "env": {
       "staging": {
         "d1_databases": [
           {
             "binding": "DB",
             "database_name": "staging-d1-tutorial",
             "database_id": "your-staging-database-id"
           }
         ]
       }
     }
   }
   ```

3. **Deploy to staging:**
   ```bash
   wrangler deploy --env staging
   ```

4. **Initialize staging database:**
   ```bash
   wrangler d1 execute DB --file=schema.sql --env staging --remote
   ```

### Copying Data Between Databases

1. **Export from source database:**
   ```bash
   wrangler d1 export DB --remote --output=prod-export.sql
   ```

2. **Import to destination database:**
   ```bash
   wrangler d1 execute DB --file=prod-export.sql --env staging --remote
   ```

## Rollback Procedures

### Rollback Worker Deployment

Cloudflare Workers supports rollback to previous versions:

1. **List recent deployments:**
   ```bash
   wrangler deployments list
   ```

2. **Rollback to a specific version:**
   ```bash
   wrangler rollback [deployment-id]
   ```

### Rollback Database Changes

D1 doesn't support automatic rollback. You must restore from backup:

1. **Restore from SQL backup:**
   ```bash
   # First, drop affected tables or clear data
   wrangler d1 execute DB --command="DROP TABLE IF EXISTS TableName;" --remote
   
   # Then restore from backup
   wrangler d1 execute DB --file=backup-YYYYMMDD-HHMMSS.sql --remote
   ```

2. **For critical data, test restoration locally first:**
   ```bash
   wrangler d1 execute DB --file=backup-YYYYMMDD-HHMMSS.sql --local
   wrangler dev
   # Verify data is correct
   ```

## Troubleshooting

### Common Issues

#### Error: "Database not found"

**Problem:** Worker can't connect to D1 database.

**Solutions:**
- Verify database binding in `wrangler.jsonc` matches your code
- Check database ID is correct: `wrangler d1 list`
- Ensure database exists: `wrangler d1 info DB`

#### Error: "Module not found" after upgrade

**Problem:** Dependencies are out of sync.

**Solutions:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate types
npm run cf-typegen
```

#### Error: "SQL error" during migration

**Problem:** Migration script has syntax errors or conflicts.

**Solutions:**
- Test migration locally first: `--local` flag
- Check SQLite/D1 compatibility: [D1 Documentation](https://developers.cloudflare.com/d1/)
- Verify foreign key constraints and indexes
- Use `.schema` command to inspect current schema:
  ```bash
  wrangler d1 execute DB --command=".schema" --remote
  ```

#### Tests failing after upgrade

**Problem:** Breaking changes in dependencies.

**Solutions:**
- Check changelog for Wrangler, Vitest, or Workers types
- Update test syntax if API changed
- Regenerate types: `npm run cf-typegen`
- Check compatibility_date in wrangler.jsonc

#### Worker exceeds size limits

**Problem:** Worker bundle too large after adding dependencies.

**Solutions:**
- Review and remove unused dependencies
- Use `wrangler dev` with `--minify` to check minified size
- Consider code splitting if needed
- Check bundle size: `wrangler deploy --dry-run`

### Getting Help

- **Cloudflare Developer Discord:** [discord.gg/cloudflaredev](https://discord.gg/cloudflaredev)
- **Cloudflare Community:** [community.cloudflare.com](https://community.cloudflare.com/)
- **D1 Documentation:** [developers.cloudflare.com/d1](https://developers.cloudflare.com/d1/)
- **Workers Documentation:** [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)
- **GitHub Issues:** [github.com/cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk)

### Debugging Tips

1. **Check Worker logs:**
   ```bash
   wrangler tail
   ```

2. **Inspect D1 database:**
   ```bash
   # List all tables
   wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
   
   # Describe a table schema
   wrangler d1 execute DB --command="PRAGMA table_info(Customers);" --remote
   
   # Query data
   wrangler d1 execute DB --command="SELECT * FROM Customers LIMIT 10;" --remote
   ```

3. **Local development debugging:**
   ```bash
   # Run with verbose logging
   wrangler dev --log-level debug
   
   # Run tests with verbose output
   npm test -- --reporter=verbose
   ```

4. **Verify deployment status:**
   ```bash
   # Check current deployment
   wrangler deployments list
   
   # View deployment details
   wrangler deployments view [deployment-id]
   ```

## Version History and Compatibility

### Compatibility Matrix

| Component | Minimum Version | Recommended Version |
|-----------|----------------|---------------------|
| Node.js | 16.13.0 | 20.x or later |
| Wrangler | 3.0.0 | Latest (4.x) |
| TypeScript | 5.0.0 | 5.5.x |
| Vitest | 2.0.0 | 3.0.x |

### Breaking Changes Log

Keep track of major changes that may affect upgrades:

- **v0.0.0 → v1.0.0:** Initial stable release
  - D1 database binding required
  - TypeScript 5.5+ required
  - Wrangler 4.14+ recommended

## Additional Resources

- [Cloudflare Workers Quick Start](https://developers.cloudflare.com/workers/get-started/guide/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/get-started/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
