// test/blockchain-webhook.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/blockchain-webhook.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Blockchain Webhook Worker", () => {
  beforeAll(async () => {
    // Initialize the database with the BlockchainWebhooks table
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
  });

  it("responds with default message for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const text = await response.text();
    expect(text).toContain("Blockchain Webhook Handler");
    expect(text).toContain("pamela");
  });

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
    expect(data.message).toContain("delay applied");
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

    const storedData = JSON.parse(results[0].data);
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

  it("applies 1-second delay before storing webhook data", async () => {
    const webhookPayload = {
      blockNumber: 99999,
      transactionHash: "0xdelay_test",
      eventType: "test_delay",
    };

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    const ctx = createExecutionContext();
    const startTime = Date.now();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    // Verify the delay was applied (should be between 950ms and 1500ms to account for timing variations)
    expect(elapsedTime).toBeGreaterThanOrEqual(950);
    expect(elapsedTime).toBeLessThan(1500);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("delay applied");
  });
});
