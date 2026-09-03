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
