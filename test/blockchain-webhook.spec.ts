// test/blockchain-webhook.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeAll, vi } from "vitest";
import worker from "../src/blockchain-webhook.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

/**
 * Build a hex-encoded HMAC-SHA256 signature for a given body and secret.
 */
async function signBody(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const TEST_SECRET = "test-webhook-secret";

describe("Blockchain Webhook Worker", () => {
  beforeAll(async () => {
    // Initialize the database with the BlockchainWebhooks table
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

  it("successfully handles POST request without WEBHOOK_SECRET configured", async () => {
    // When env.WEBHOOK_SECRET is not set, signature check is skipped
    const webhookPayload = {
      blockNumber: 12345,
      transactionHash: "0xabc123def456",
      from: "0x1234567890abcdef",
      to: "0xfedcba0987654321",
      value: "1000000000000000000",
    };

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  it("rejects POST without signature when WEBHOOK_SECRET is set", async () => {
    const envWithSecret = { ...env, WEBHOOK_SECRET: TEST_SECRET };
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockNumber: 1 }),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, envWithSecret, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("missing signature");
  });

  it("rejects POST with invalid signature when WEBHOOK_SECRET is set", async () => {
    const envWithSecret = { ...env, WEBHOOK_SECRET: TEST_SECRET };
    const body = JSON.stringify({ blockNumber: 2 });
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": "deadbeef",
      },
      body,
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, envWithSecret, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("invalid signature");
  });

  it("accepts POST with valid HMAC signature", async () => {
    const envWithSecret = { ...env, WEBHOOK_SECRET: TEST_SECRET };
    const payload = { blockNumber: 99999, transactionHash: "0xsigned" };
    const body = JSON.stringify(payload);
    const sig = await signBody(TEST_SECRET, body);

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sig,
      },
      body,
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, envWithSecret, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("deduplicates requests with same Webhook-ID", async () => {
    const body = JSON.stringify({ blockNumber: 777 });
    const request1 = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Webhook-ID": "unique-id-abc",
      },
      body,
    });
    const request2 = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Webhook-ID": "unique-id-abc",
      },
      body,
    });

    const ctx1 = createExecutionContext();
    const resp1 = await worker.fetch(request1, env, ctx1);
    await waitOnExecutionContext(ctx1);
    expect(resp1.status).toBe(200);
    const data1 = await resp1.json();
    expect(data1.success).toBe(true);

    const ctx2 = createExecutionContext();
    const resp2 = await worker.fetch(request2, env, ctx2);
    await waitOnExecutionContext(ctx2);
    expect(resp2.status).toBe(200);
    const data2 = await resp2.json();
    // Duplicate is silently accepted but ignored
    expect(data2.success).toBe(true);
    expect(data2.message).toContain("Duplicate webhook ignored");
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

  it("returns default response for non-webhook paths", async () => {
    const request = new IncomingRequest("http://example.com/other", {
      method: "POST",
      body: JSON.stringify({ any: "payload" }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Blockchain Webhook Handler");
    expect(text).toContain("POST to /webhook");
  });

  it("stores webhook data in the database", async () => {
    const webhookPayload = {
      blockNumber: 11111,
      transactionHash: "0xtest123",
      eventType: "transfer",
    };

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
    // Must not leak internal error details
    expect(data).not.toHaveProperty("details");
  });

  it("returns 500 when database insert fails", async () => {
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ blockNumber: 999 }),
    });
    const ctx = createExecutionContext();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockEnv = {
      ...env,
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => {
              throw new Error("simulated-insert-failure");
            },
          }),
        }),
      },
    } as unknown as Env;

    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Failed to process blockchain webhook");
    expect(data).not.toHaveProperty("details");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
