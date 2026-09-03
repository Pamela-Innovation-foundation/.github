// test/index.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll, vi } from "vitest";
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
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("responds with default message for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
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

  it("rejects requests to other /api routes without API key", async () => {
    const response = await SELF.fetch("https://example.com/api/unknown-route");

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("allows authenticated requests to unknown /api routes and falls back", async () => {
    const response = await SELF.fetch("https://example.com/api/unknown-route", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("returns 500 when beverages database query fails", async () => {
    const request = new IncomingRequest("http://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    const ctx = createExecutionContext();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockEnv = {
      ...env,
      API_KEY: "test-api-key-12345",
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              throw new Error("simulated-db-error");
            },
          }),
        }),
      },
    } as unknown as Env;

    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch beverages data",
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns digital clock HTML page", async () => {
    const response = await SELF.fetch("https://example.com/clock");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const html = await response.text();
    expect(html).toContain("Digital Clock");
    expect(html).toContain("America/New_York");
    expect(html).toContain("Asia/Tokyo");
    expect(html).toContain("Europe/London");
    expect(html).toContain('id="clocks"');
    expect(html).toContain("setInterval");
  });

  describe("/api/webhooks endpoint", () => {
    beforeAll(async () => {
      await env.DB.batch([
        env.DB.prepare(`DROP TABLE IF EXISTS BlockchainWebhooks`),
        env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            webhook_id TEXT
          )`
        ),
        env.DB.prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_blockchain_webhooks_webhook_id
           ON BlockchainWebhooks (webhook_id)
           WHERE webhook_id IS NOT NULL`
        ),
        env.DB.prepare(
          `INSERT INTO BlockchainWebhooks (data, timestamp, webhook_id) VALUES (?, ?, ?)`
        ).bind('{"tx":"0xabc"}', "2024-01-01T00:00:00.000Z", "wh-1"),
        env.DB.prepare(
          `INSERT INTO BlockchainWebhooks (data, timestamp, webhook_id) VALUES (?, ?, ?)`
        ).bind('{"tx":"0xdef"}', "2024-01-02T00:00:00.000Z", "wh-2"),
      ]);
    });

    it("returns stored webhooks when authenticated", async () => {
      const response = await SELF.fetch("https://example.com/api/webhooks", {
        headers: { "X-API-Key": "test-api-key-12345" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("webhook_id");
      expect(data[0]).toHaveProperty("timestamp");
    });

    it("rejects unauthenticated requests to /api/webhooks", async () => {
      const response = await SELF.fetch("https://example.com/api/webhooks");
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("returns empty array when no webhooks exist", async () => {
      await env.DB.exec(`DELETE FROM BlockchainWebhooks`);
      const response = await SELF.fetch("https://example.com/api/webhooks", {
        headers: { "X-API-Key": "test-api-key-12345" },
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("returns 500 when webhooks database query fails", async () => {
      const request = new IncomingRequest("http://example.com/api/webhooks", {
        headers: { "X-API-Key": "test-api-key-12345" },
      });
      const ctx = createExecutionContext();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockEnv = {
        ...env,
        API_KEY: "test-api-key-12345",
        DB: {
          prepare: () => ({
            all: async () => {
              throw new Error("simulated-db-error");
            },
          }),
        },
      } as unknown as Env;

      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Failed to fetch webhooks",
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
