// test/index.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("D1 Beverages Worker", () => {
  it("returns unauthorized for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - interaction is disabled",
    });
  });

  it("returns unauthorized for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - interaction is disabled",
    });
  });

  it("returns unauthorized for API route with API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - interaction is disabled",
    });
  });

  it("returns unauthorized for non-api routes", async () => {
    const response = await SELF.fetch("https://example.com/clock");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - interaction is disabled",
    });
  });
});

describe("Landmarks API", () => {
  it("returns unauthorized without API key (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/landmarks");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns landmarks from the database (unit style)", async () => {
    const mockResults = [
      {
        id: 1,
        name: "Ram Mandir",
        location: "Ayodhya, India",
        description: "A grand Hindu temple inaugurated in January 2024.",
        created_at: "2024-01-22",
      },
    ];

    const mockDB = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: mockResults }),
        }),
      }),
    };

    const request = new IncomingRequest("http://example.com/api/landmarks");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { landmarks: typeof mockResults };
    expect(body.landmarks).toEqual(mockResults);
  });

  it("uses default since date of 2024-01-01 when no query param provided (unit style)", async () => {
    let boundValue: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (val: string) => {
          boundValue = val;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest("http://example.com/api/landmarks");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(boundValue).toBe("2024-01-01T00:00:00");
  });

  it("accepts a custom since query parameter (unit style)", async () => {
    let boundValue: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (val: string) => {
          boundValue = val;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/landmarks?since=2024-06-01"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(boundValue).toBe("2024-06-01");
  });

  it("returns 500 on database error (unit style)", async () => {
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          all: async () => {
            throw new Error("DB connection failed");
          },
        }),
      }),
    };

    const request = new IncomingRequest("http://example.com/api/landmarks");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});

describe("ETH Balance API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const makeMockEnv = (overrides?: Partial<Env>) =>
    ({
      API_KEY: "test-api-key-12345",
      ETH_RPC_URL: "https://cloudflare-eth.com",
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => ({}),
            all: async () => ({ results: [] }),
          }),
          all: async () => ({ results: [] }),
        }),
      },
      ...overrides,
    }) as unknown as Env;

  it("returns 400 for a missing address", async () => {
    const request = new IncomingRequest("http://example.com/api/eth-balance");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Ethereum address",
    });
  });

  it("returns 400 for an invalid ETH address", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/eth-balance?address=not-an-address"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Ethereum address",
    });
  });

  it("returns balance for a valid ETH address", async () => {
    // 1 ETH in wei = 0xde0b6b3a7640000
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: "0xde0b6b3a7640000",
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      `http://example.com/api/eth-balance?address=${validAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      address: string;
      balanceWei: string;
      balanceEth: string;
    };
    expect(body.address).toBe(validAddress);
    expect(body.balanceWei).toBe("1000000000000000000");
    expect(body.balanceEth).toBe("1.000000000000000000");
  });

  it("correctly formats fractional ETH balances (< 1 ETH)", async () => {
    // 0.001 ETH = 1_000_000_000_000_000 wei = 0xde0b6b3a7640 hex
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: "0x38d7ea4c68000",
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      `http://example.com/api/eth-balance?address=${validAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      balanceWei: string;
      balanceEth: string;
    };
    expect(body.balanceWei).toBe("1000000000000000");
    expect(body.balanceEth).toBe("0.001000000000000000");
  });

  it("returns 502 when the RPC provider is unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Network error");
    });

    const request = new IncomingRequest(
      `http://example.com/api/eth-balance?address=${validAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to reach Ethereum RPC provider",
    });
  });

  it("returns 502 when the RPC returns an error payload", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "execution reverted" },
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      `http://example.com/api/eth-balance?address=${validAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeMockEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
  });

  it("returns history from the database", async () => {
    const mockHistory = [
      {
        id: 1,
        address: validAddress,
        balance_eth: "1.000000000000000000",
        queried_at: "2024-01-22 10:00:00",
      },
    ];

    const mockEnv = makeMockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => ({}),
            all: async () => ({ results: mockHistory }),
          }),
          all: async () => ({ results: mockHistory }),
        }),
      } as unknown as D1Database,
    });

    const request = new IncomingRequest(
      "http://example.com/api/eth-balance/history"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { history: typeof mockHistory };
    expect(body.history).toEqual(mockHistory);
  });
});

describe("Pay endpoint", () => {
  const receivingWallet = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
  const validPayerAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const makePayEnv = () =>
    ({
      API_KEY: "test-api-key-12345",
      ETH_RPC_URL: "https://cloudflare-eth.com",
      RECEIVING_WALLET: receivingWallet,
      DB: undefined,
    }) as unknown as Env;

  it("returns payment instructions for the pro plan", async () => {
    const request = new IncomingRequest("http://example.com/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", payer_address: validPayerAddress }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makePayEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      receiving_address: string;
      amount_eth: string;
      amount_wei: string;
      plan: string;
      payer_address: string;
    };
    expect(body.receiving_address).toBe(receivingWallet);
    expect(body.amount_eth).toBe("0.010000000000000000");
    expect(body.amount_wei).toBe("10000000000000000");
    expect(body.plan).toBe("pro");
    expect(body.payer_address).toBe(validPayerAddress);
  });

  it("returns payment instructions for the enterprise plan", async () => {
    const request = new IncomingRequest("http://example.com/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "enterprise",
        payer_address: validPayerAddress,
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makePayEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      amount_eth: string;
      plan: string;
    };
    expect(body.amount_eth).toBe("0.100000000000000000");
    expect(body.plan).toBe("enterprise");
  });

  it("returns 400 for an unknown plan", async () => {
    const request = new IncomingRequest("http://example.com/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "free", payer_address: validPayerAddress }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makePayEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid plan. Valid options: pro, enterprise",
    });
  });

  it("returns 400 for an invalid payer address", async () => {
    const request = new IncomingRequest("http://example.com/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", payer_address: "not-an-address" }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makePayEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payer Ethereum address",
    });
  });
});

describe("Activate endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validTxHash = "0x" + "a".repeat(64);
  const validAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const receivingWallet = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";

  const makeActivateEnv = (dbOverride?: unknown) =>
    ({
      API_KEY: "test-api-key-12345",
      ETH_RPC_URL: "https://cloudflare-eth.com",
      RECEIVING_WALLET: receivingWallet,
      DB: dbOverride ?? {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
            run: async () => ({}),
          }),
        }),
      },
    }) as unknown as Env;

  it("returns 400 for an invalid transaction hash format", async () => {
    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: "0xinvalid",
        payer_address: validAddress,
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeActivateEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid transaction hash",
    });
  });

  it("returns 400 for an invalid payer address", async () => {
    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: validTxHash,
        payer_address: "not-an-address",
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeActivateEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payer Ethereum address",
    });
  });

  it("returns 409 when transaction hash is already used", async () => {
    const dbWithExistingKey = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 42 }),
          run: async () => ({}),
        }),
      }),
    };
    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: validTxHash,
        payer_address: validAddress,
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      request,
      makeActivateEnv(dbWithExistingKey),
      ctx
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Transaction already used to provision a key",
    });
  });

  it("provisions an API key for a valid confirmed transaction", async () => {
    // 0x2386f26fc10000 = 10000000000000000 wei = 0.01 ETH
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              to: receivingWallet.toLowerCase(),
              from: validAddress.toLowerCase(),
              value: "0x2386f26fc10000",
              blockHash: "0x" + "b".repeat(64),
            },
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: validTxHash,
        payer_address: validAddress,
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeActivateEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      api_key: string;
      plan: string;
      monthly_limit: number;
    };
    expect(typeof body.api_key).toBe("string");
    expect(body.api_key.length).toBeGreaterThan(0);
    expect(body.plan).toBe("pro");
    expect(body.monthly_limit).toBe(10000);
  });

  it("returns 202 for a pending (unconfirmed) transaction", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              to: receivingWallet.toLowerCase(),
              from: validAddress.toLowerCase(),
              value: "0x2386f26fc10000",
              blockHash: null,
            },
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: validTxHash,
        payer_address: validAddress,
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeActivateEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      error: "Transaction is pending - please wait for confirmation",
    });
  });

  it("returns 400 when transaction value is below plan price", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              to: receivingWallet.toLowerCase(),
              from: validAddress.toLowerCase(),
              value: "0x1",
              blockHash: "0x" + "b".repeat(64),
            },
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest("http://example.com/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: validTxHash,
        payer_address: validAddress,
        plan: "pro",
      }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeActivateEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Transaction value is less than the required plan price",
    });
  });
});

describe("Usage API", () => {
  it("returns admin quota when using the admin key", async () => {
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const request = new IncomingRequest("http://example.com/api/usage");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      plan: "admin",
      usage_count: null,
      monthly_limit: "unlimited",
      remaining: "unlimited",
    });
  });

  it("returns quota info for a D1 API key", async () => {
    const keyRow = {
      id: 7,
      plan: "pro",
      monthly_limit: 10000,
      usage_count: 42,
      active: 1,
    };
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          first: async () => keyRow,
          run: async () => ({}),
        }),
      }),
    };
    const mockEnv = {
      API_KEY: "admin-secret",
      DB: mockDB,
    } as unknown as Env;
    const request = new IncomingRequest("http://example.com/api/usage");
    request.headers.set("X-API-Key", "d1-user-key");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      plan: string;
      usage_count: number;
      monthly_limit: number;
      remaining: number;
    };
    expect(body.plan).toBe("pro");
    expect(body.usage_count).toBe(42);
    expect(body.monthly_limit).toBe(10000);
    expect(body.remaining).toBe(9958);
  });

  it("returns 429 when monthly limit is exceeded", async () => {
    const keyRow = {
      id: 7,
      plan: "pro",
      monthly_limit: 100,
      usage_count: 100,
      active: 1,
    };
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          first: async () => keyRow,
          run: async () => ({}),
        }),
      }),
    };
    const mockEnv = {
      API_KEY: "admin-secret",
      DB: mockDB,
    } as unknown as Env;
    const request = new IncomingRequest("http://example.com/api/usage");
    request.headers.set("X-API-Key", "d1-user-key");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Monthly request limit exceeded",
    });
  });

  it("returns 401 for an unknown D1 key", async () => {
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => ({}),
        }),
      }),
    };
    const mockEnv = {
      API_KEY: "admin-secret",
      DB: mockDB,
    } as unknown as Env;
    const request = new IncomingRequest("http://example.com/api/usage");
    request.headers.set("X-API-Key", "unknown-key");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });
});

describe("Webhook endpoint", () => {
  it("stores webhook payload and returns success", async () => {
    let insertedData: string | undefined;
    let insertedTimestamp: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (data: string, timestamp: string) => {
          insertedData = data;
          insertedTimestamp = timestamp;
          return {
            run: async () => ({ meta: { last_row_id: 42 } }),
          };
        },
      }),
    };
    const mockEnv = { DB: mockDB } as unknown as Env;

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "transfer", value: 100 }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      access: boolean;
      message: string;
      webhookId: number;
      timestamp: string;
    };
    expect(body.success).toBe(true);
    expect(body.access).toBe(true);
    expect(body.message).toContain("pamela");
    expect(body.webhookId).toBe(42);
    expect(typeof body.timestamp).toBe("string");
    expect(JSON.parse(insertedData!)).toEqual({ event: "transfer", value: 100 });
    expect(typeof insertedTimestamp).toBe("string");
  });

  it("rejects non-POST webhook requests with 405", async () => {
    const mockEnv = { DB: undefined } as unknown as Env;
    const request = new IncomingRequest("http://example.com/webhook");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Method not allowed");
  });

  it("returns generic 500 without leaking error details on malformed JSON", async () => {
    const mockEnv = { DB: undefined } as unknown as Env;
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      success: boolean;
      error: string;
      details?: unknown;
    };
    expect(body.success).toBe(false);
    expect(body.error).toContain("pamela");
    expect(body.details).toBeUndefined();
  });
});
