// test/blockchain-webhook.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/blockchain-webhook.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const makeMockEnv = (dbOverride?: unknown) =>
  ({
    API_KEY: "test-api-key-12345",
    DB: dbOverride ?? {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      }),
    },
  }) as unknown as Env;

describe("Blockchain Webhook Worker", () => {
  it("returns 404 for root path", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 404 for unknown paths", async () => {
    const request = new IncomingRequest("http://example.com/other", {
      method: "GET",
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 405 for GET to /webhook/blockchain", async () => {
    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      { method: "GET" }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
  });

  it("returns 401 without API key", async () => {
    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockNumber: 12345 }),
      }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns 401 with wrong API key", async () => {
    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "wrong-key",
        },
        body: JSON.stringify({ blockNumber: 12345 }),
      }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key-12345",
        },
        body: "not-valid-json",
      }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("stores webhook event and returns 200 with id", async () => {
    let storedData: string | undefined;
    let storedTimestamp: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (data: string, ts: string) => {
          storedData = data;
          storedTimestamp = ts;
          return { run: async () => ({ meta: { last_row_id: 42 } }) };
        },
      }),
    };

    const payload = { blockNumber: 12345, txHash: "0xabc" };
    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key-12345",
        },
        body: JSON.stringify(payload),
      }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(mockDB), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; id: number };
    expect(body.success).toBe(true);
    expect(body.id).toBe(42);
    expect(JSON.parse(storedData!)).toEqual(payload);
    expect(typeof storedTimestamp).toBe("string");
    expect(storedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("returns 500 on database error", async () => {
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            throw new Error("DB write failed");
          },
        }),
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/webhook/blockchain",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key-12345",
        },
        body: JSON.stringify({ blockNumber: 12345 }),
      }
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(mockDB), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
