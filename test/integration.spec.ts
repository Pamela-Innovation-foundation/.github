// test/integration.spec.ts
// #5 — Integration tests that run against the real isolated D1 binding.
// These catch SQL mistakes that mock-based tests silently swallow.
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

// Seed the isolated D1 instance with the schema tables used by the worker.
// We only create what these tests actually exercise to keep setup fast.
async function seedSchema() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS EthBalanceLookups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      balance_eth TEXT NOT NULL,
      queried_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ApiKeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'pro',
      monthly_limit INTEGER NOT NULL DEFAULT 10000,
      usage_count INTEGER NOT NULL DEFAULT 0,
      reset_at TEXT NOT NULL DEFAULT (datetime('now', '+1 month')),
      active INTEGER NOT NULL DEFAULT 1,
      tx_hash TEXT UNIQUE,
      payer_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS Landmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS RateLimitLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
  ]);
}

describe("Integration: /api/webhooks (D1 real binding)", () => {
  beforeAll(async () => {
    await seedSchema();
    // Seed two webhook rows
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
      ).bind('{"block":1}', "2024-01-01 00:00:00"),
      env.DB.prepare(
        "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
      ).bind('{"block":2}', "2024-01-02 00:00:00"),
    ]);
  });

  it("GET /api/webhooks returns stored rows (real D1)", async () => {
    const response = await SELF.fetch("https://example.com/api/webhooks", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      webhooks: { id: number; data: string; timestamp: string }[];
    };
    expect(Array.isArray(body.webhooks)).toBe(true);
    expect(body.webhooks.length).toBeGreaterThanOrEqual(2);
    // Rows come back ordered newest-first
    expect(body.webhooks[0].data).toBe('{"block":2}');
  });

  it("POST /api/webhooks/blockchain stores a new row (real D1)", async () => {
    const payload = { blockNumber: 9999, txHash: "0xabc" };
    const response = await SELF.fetch(
      "https://example.com/api/webhooks/blockchain",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key-12345",
        },
        body: JSON.stringify(payload),
      }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; id: number };
    expect(body.success).toBe(true);
    expect(typeof body.id).toBe("number");

    // Verify the row was actually written
    const row = await env.DB.prepare(
      "SELECT data FROM BlockchainWebhooks WHERE id = ?"
    )
      .bind(body.id)
      .first<{ data: string }>();
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.data)).toEqual(payload);
  });
});

describe("Integration: /api/eth-balance/history (D1 real binding)", () => {
  beforeAll(async () => {
    await seedSchema();
    await env.DB.prepare(
      "INSERT INTO EthBalanceLookups (address, balance_eth) VALUES (?, ?)"
    )
      .bind("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "1.000000000000000000")
      .run();
  });

  it("returns stored lookups (real D1)", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/eth-balance/history",
      { headers: { "X-API-Key": "test-api-key-12345" } }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      history: { id: number; address: string; balance_eth: string }[];
    };
    expect(Array.isArray(body.history)).toBe(true);
    const entry = body.history.find(
      (r) => r.address === "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    );
    expect(entry).toBeDefined();
    expect(entry!.balance_eth).toBe("1.000000000000000000");
  });
});

describe("Integration: API key lifecycle (D1 real binding)", () => {
  beforeAll(async () => {
    await seedSchema();
  });

  it("provisioned key is active and revocable (real D1)", async () => {
    // Insert a key directly
    const keyValue = "integ-test-key-" + Math.random().toString(36).slice(2);
    await env.DB.prepare(
      "INSERT INTO ApiKeys (key, plan, monthly_limit, usage_count, reset_at, active) VALUES (?, 'pro', 10000, 0, datetime('now', '+1 month'), 1)"
    )
      .bind(keyValue)
      .run();

    // Read its id back
    const row = await env.DB.prepare(
      "SELECT id FROM ApiKeys WHERE key = ?"
    )
      .bind(keyValue)
      .first<{ id: number }>();
    expect(row).not.toBeNull();
    const keyId = row!.id;

    // Revoke via DELETE /api/keys/:id (admin key)
    const delResponse = await SELF.fetch(
      `https://example.com/api/keys/${keyId}`,
      {
        method: "DELETE",
        headers: { "X-API-Key": "test-api-key-12345" },
      }
    );
    expect(delResponse.status).toBe(200);
    const delBody = (await delResponse.json()) as {
      success: boolean;
      active: boolean;
    };
    expect(delBody.success).toBe(true);
    expect(delBody.active).toBe(false);

    // Confirm the DB row is now inactive
    const updated = await env.DB.prepare(
      "SELECT active FROM ApiKeys WHERE id = ?"
    )
      .bind(keyId)
      .first<{ active: number }>();
    expect(updated!.active).toBe(0);
  });

  it("revoked key is rejected at auth (real D1)", async () => {
    const keyValue = "revoked-key-" + Math.random().toString(36).slice(2);
    await env.DB.prepare(
      "INSERT INTO ApiKeys (key, plan, monthly_limit, usage_count, reset_at, active) VALUES (?, 'pro', 10000, 0, datetime('now', '+1 month'), 0)"
    )
      .bind(keyValue)
      .run();

    const response = await SELF.fetch(
      "https://example.com/api/webhooks",
      { headers: { "X-API-Key": keyValue } }
    );
    expect(response.status).toBe(401);
  });
});

describe("Integration: /api/landmarks (D1 real binding)", () => {
  beforeAll(async () => {
    await seedSchema();
    await env.DB.prepare(
      "INSERT INTO Landmarks (name, location, description, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind("Test Bridge", "Test City", "A test landmark.", "2024-05-01")
      .run();
  });

  it("returns landmarks filtered by since (real D1)", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=2024-04-01",
      { headers: { "X-API-Key": "test-api-key-12345" } }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      landmarks: { name: string }[];
    };
    expect(Array.isArray(body.landmarks)).toBe(true);
    expect(body.landmarks.some((l) => l.name === "Test Bridge")).toBe(true);
  });

  it("returns no landmarks before the since date (real D1)", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=2025-01-01",
      { headers: { "X-API-Key": "test-api-key-12345" } }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { landmarks: { name: string }[] };
    expect(body.landmarks.some((l) => l.name === "Test Bridge")).toBe(false);
  });
});
