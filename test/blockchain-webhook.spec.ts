// test/blockchain-webhook.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src/blockchain-webhook.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const samplePayload = {
  network: "ethereum",
  event: "transaction",
  txHash: "0x1234abcd",
  blockNumber: 12345678,
};

function makeMockEnv(overrides?: Partial<Env>): Env {
  const runFn = vi.fn().mockResolvedValue({ success: true });
  const bindFn = vi.fn().mockReturnValue({ run: runFn });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
  return {
    API_KEY: "test-api-key-12345",
    DB: { prepare: prepareFn } as unknown as D1Database,
    ...overrides,
  } as unknown as Env;
}

describe("Blockchain Webhook Worker", () => {
  it("stores webhook data and returns 201 on valid POST", async () => {
    const env = makeMockEnv();
    const prepareFn = env.DB.prepare as ReturnType<typeof vi.fn>;
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect((body as { success: boolean }).success).toBe(true);
    expect(typeof (body as { timestamp: string }).timestamp).toBe("string");

    expect(prepareFn).toHaveBeenCalledWith(
      "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
    );
    const bindFn = prepareFn.mock.results[0].value.bind as ReturnType<
      typeof vi.fn
    >;
    expect(bindFn).toHaveBeenCalledWith(
      JSON.stringify(samplePayload),
      expect.any(String)
    );
  });

  it("returns 401 when API key is missing", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns 401 when API key is wrong", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "wrong-key",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });

  it("returns 405 for GET requests to /webhook", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
  });

  it("returns 400 for invalid JSON body", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: "not valid json {{{",
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("returns 415 when Content-Type is not application/json", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Content-Type must be application/json",
    });
  });

  it("returns 400 when payload is not a JSON object", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(["event", "not", "object"]),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook payload must be a JSON object",
    });
  });

  it("returns 500 when database insert fails", async () => {
    const env = makeMockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            run: vi.fn().mockRejectedValue(new Error("DB connection failed")),
          }),
        }),
      } as unknown as D1Database,
    });

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to store webhook data",
    });
  });

  it("returns 404 for unknown paths", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/other", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});
