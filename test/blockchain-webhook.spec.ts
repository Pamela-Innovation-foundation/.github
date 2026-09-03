import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/blockchain-webhook.js";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

type StoredWebhook = {
  webhookId: string;
  data: string;
  status: string;
  processedAt: string | null;
};

function createMockDb() {
  const rows = new Map<string, StoredWebhook>();

  return {
    rows,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO BlockchainWebhooks")) {
                const [webhookId, data] = args as [string, string];

                if (rows.has(webhookId)) {
                  throw new Error(
                    "D1_ERROR: UNIQUE constraint failed: BlockchainWebhooks.webhook_id"
                  );
                }

                rows.set(webhookId, {
                  webhookId,
                  data,
                  status: "received",
                  processedAt: null,
                });

                return { success: true };
              }

              if (sql.startsWith("UPDATE BlockchainWebhooks SET status = ?")) {
                const [status, webhookId] = args as [string, string];
                const row = rows.get(webhookId);

                if (!row) {
                  throw new Error("Missing webhook row");
                }

                row.status = status;
                row.processedAt = new Date().toISOString();

                return { success: true };
              }

              throw new Error(`Unexpected SQL in test double: ${sql}`);
            },
          };
        },
      };
    },
  };
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function createSignedRequest(
  payload: Record<string, unknown>,
  webhookId = "wh_123",
  includeSignature = true
) {
  const secret = "test-webhook-secret";
  const rawPayload = JSON.stringify(payload);
  const headers = new Headers({ "Content-Type": "application/json" });

  if (webhookId) {
    headers.set("Webhook-ID", webhookId);
  }

  if (includeSignature) {
    headers.set("Webhook-Signature", await signPayload(secret, rawPayload));
  }

  return {
    env: {
      DB: createMockDb(),
      WEBHOOK_SECRET: secret,
    } as unknown as Env,
    request: new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers,
      body: rawPayload,
    }),
  };
}

describe("Blockchain Webhook Worker", () => {
  it("returns 404 for non-webhook paths", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new IncomingRequest("http://example.com/other"),
      { DB: createMockDb(), WEBHOOK_SECRET: "test-webhook-secret" } as Env,
      ctx
    );

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 405 for non-POST webhook requests", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new IncomingRequest("http://example.com/webhook", { method: "GET" }),
      { DB: createMockDb(), WEBHOOK_SECRET: "test-webhook-secret" } as Env,
      ctx
    );

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
  });

  it("returns 400 when the webhook signature is invalid", async () => {
    const { env, request } = await createSignedRequest(
      { blockNumber: 12345 },
      "wh_invalid",
      false
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid signature");
    expect(env.DB.rows.size).toBe(0);
  });

  it("returns 400 when the webhook id is missing", async () => {
    const { env, request } = await createSignedRequest(
      { blockNumber: 12345 },
      ""
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Webhook-ID header",
    });
    expect(env.DB.rows.size).toBe(0);
  });

  it("stores and processes a verified webhook asynchronously", async () => {
    const payload = {
      network: "ethereum",
      event: "transaction",
      txHash: "0x1234",
    };
    const { env, request } = await createSignedRequest(payload, "wh_async");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    expect(response.status).toBe(200);
    expect(env.DB.rows.get("wh_async")).toMatchObject({
      webhookId: "wh_async",
      data: JSON.stringify(payload),
    });

    await waitOnExecutionContext(ctx);

    expect(env.DB.rows.get("wh_async")).toMatchObject({
      webhookId: "wh_async",
      data: JSON.stringify(payload),
      status: "processed",
    });
    expect(env.DB.rows.get("wh_async")?.processedAt).toEqual(
      expect.any(String)
    );
  });

  it("returns 200 for duplicate webhook ids without reprocessing", async () => {
    const payload = { blockNumber: 12345 };
    const { env, request } = await createSignedRequest(payload, "wh_duplicate");
    const duplicateRequest = request.clone();

    const firstCtx = createExecutionContext();
    const firstResponse = await worker.fetch(request, env, firstCtx);
    expect(firstResponse.status).toBe(200);

    const secondCtx = createExecutionContext();
    const secondResponse = await worker.fetch(duplicateRequest, env, secondCtx);

    await waitOnExecutionContext(firstCtx);
    await waitOnExecutionContext(secondCtx);

    expect(secondResponse.status).toBe(200);
    expect(env.DB.rows.size).toBe(1);
    expect(env.DB.rows.get("wh_duplicate")).toMatchObject({
      status: "processed",
    });
  });
});
