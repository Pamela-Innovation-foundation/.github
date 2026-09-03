// test/index.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("D1 Beverages Worker", () => {
  beforeAll(async () => {
    // Initialize the database with test data
    // Use batch for better performance with multiple inserts
    await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)`
    );

    // Use batch() for BlockchainWebhooks table setup
    await env.DB.batch([
      env.DB.prepare(`DROP TABLE IF EXISTS BlockchainWebhooks`),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
      ),
    ]);

    // Use batch() for efficient multiple inserts
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(1, "Alfreds Futterkiste", "Maria Anders"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(4, "Around the Horn", "Thomas Hardy"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(11, "Bs Beverages", "Victoria Ashworth"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(13, "Bs Beverages", "Random Name"),
    ]);
  });

  it("responds with default message for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    // Create an empty context to pass to `worker.fetch()`.
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    const text = await response.text();
    expect(text).toContain("Unified Worker");
    expect(text).toContain("/api/beverages");
    expect(text).toContain("/webhook");
    expect(text).toContain("pamela");
  });

  it("responds with default message for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    const text = await response.text();
    expect(text).toContain("Unified Worker");
    expect(text).toContain("/api/beverages");
    expect(text).toContain("/webhook");
  });

  it("returns beverages data from database (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]).toHaveProperty("CompanyName", "Bs Beverages");
    expect(data[0]).toHaveProperty("ContactName");
    expect(data[0]).toHaveProperty("CustomerId");
  });

  it("returns beverages data from database (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it("rejects requests without API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages");
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("Unauthorized");
  });

  it("rejects requests with invalid API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "invalid-key" },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("Unauthorized");
  });

  // Blockchain webhook tests
  it("successfully handles POST request with blockchain data (unit style)", async () => {
    const webhookPayload = {
      blockNumber: 12345,
      transactionHash: "0xabc123def456",
      from: "0x1234567890abcdef",
      to: "0xfedcba0987654321",
      value: "1000000000000000000",
    };

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("pamela");
    expect(data.message).toContain("Blockchain webhook received and stored");
    expect(data).toHaveProperty("webhookId");
    expect(data).toHaveProperty("timestamp");
  });

  it("returns 405 for non-POST requests to /webhook", async () => {
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "GET",
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data).toHaveProperty("error");
    expect(data.error).toContain("Method not allowed");
  });

  it("stores webhook data in the database", async () => {
    const webhookPayload = {
      blockNumber: 11111,
      transactionHash: "0xtest123",
      eventType: "transfer",
    };

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    const data = await response.json();
    const webhookId = data.webhookId;

    // Query the database to verify the data was stored
    const { results } = await env.DB.prepare(
      "SELECT * FROM BlockchainWebhooks WHERE id = ?"
    )
      .bind(webhookId)
      .all();

    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty("data");
    expect(results[0]).toHaveProperty("timestamp");

    const storedData = JSON.parse(results[0].data as string);
    expect(storedData.blockNumber).toBe(11111);
    expect(storedData.transactionHash).toBe("0xtest123");
  });

  it("handles invalid JSON gracefully", async () => {
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "invalid json {",
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Failed to process blockchain webhook");
    expect(data.error).toContain("pamela");
  });
});
