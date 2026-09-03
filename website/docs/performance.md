---
id: performance
sidebar_position: 5
---

# Performance Optimizations

This document outlines the performance improvements made to the pamela application.

## Database Query Optimizations

### 1. Explicit Column Selection (High Impact)

**Before:**

```sql
SELECT * FROM Customers WHERE CompanyName = ?
```

**After:**

```sql
SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?
```

**Benefits:**

- Reduces data transfer between D1 database and Worker
- Improves query performance by only fetching required columns
- Reduces memory usage in the Worker runtime
- Makes the API contract explicit and maintainable

### 2. Caching API Responses

Add `Cache-Control` headers to read-only endpoints:

```typescript
return Response.json(results, {
  headers: {
    "Cache-Control": "public, max-age=60",
  },
});
```

**Benefits:**

- Reduces repeated database queries for the same data
- Improves response times for frequently accessed endpoints
- Reduces load on the D1 database

### 3. Batch Database Operations

Use `.batch()` for multiple database operations:

```typescript
await env.DB.batch([
  env.DB.prepare("INSERT INTO Customers VALUES (?, ?, ?)").bind(1, "Name1", "Contact1"),
  env.DB.prepare("INSERT INTO Customers VALUES (?, ?, ?)").bind(2, "Name2", "Contact2"),
]);
```

**Benefits:**

- Executes multiple queries in a single round-trip to D1
- Significantly reduces latency for bulk operations
- Ideal for seeding test data

## Best Practices

1. **Always use prepared statements** with `.bind()` to prevent SQL injection
2. **Select only needed columns** instead of `SELECT *`
3. **Add appropriate indexes** for frequently queried columns
4. **Use batch operations** for multiple inserts/updates
5. **Cache responses** with appropriate `Cache-Control` headers for read-only data
