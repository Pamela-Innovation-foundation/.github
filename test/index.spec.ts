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

describe("ERC-1155 export API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const contract = "0xf639b4ebb77df1ed4b5014c244f60e72b8adb29b";
  const trackedAddress = "0x71c7656ec7ab88b098defb751b7401b5f6d8976f";
  const otherAddress = "0xea23a5395ea6b0358afe15edc4be19cd98ad9874";

  const makeExportEnv = () =>
    ({
      API_KEY: "test-api-key-12345",
      ETH_RPC_URL: "https://cloudflare-eth.com",
      DB: undefined,
    }) as unknown as Env;

  const topicForAddress = (address: string) =>
    `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

  const encodeWord = (value: bigint) => value.toString(16).padStart(64, "0");

  const encodeUint256Array = (values: bigint[]) =>
    `${encodeWord(BigInt(values.length))}${values.map(encodeWord).join("")}`;

  const encodeBatchData = (ids: bigint[], values: bigint[]) => {
    const idsData = encodeUint256Array(ids);
    const valuesData = encodeUint256Array(values);
    const idsOffset = 64n;
    const valuesOffset = idsOffset + BigInt(idsData.length / 2);

    return `0x${encodeWord(idsOffset)}${encodeWord(valuesOffset)}${idsData}${valuesData}`;
  };

  it("exports token ID 1 mint rows filtered to the Ethereum address", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: [
              {
                address: contract,
                blockNumber: "0x12a7b83",
                transactionHash: "0x" + "1".repeat(64),
                logIndex: "0x0",
                topics: [
                  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
                  topicForAddress(trackedAddress),
                  topicForAddress("0x0000000000000000000000000000000000000000"),
                  topicForAddress(trackedAddress),
                ],
                data: `0x${encodeWord(1n)}${encodeWord(1n)}`,
              },
              {
                address: contract,
                blockNumber: "0x12a7b84",
                transactionHash: "0x" + "2".repeat(64),
                logIndex: "0x1",
                topics: [
                  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb",
                  topicForAddress(trackedAddress),
                  topicForAddress("0x0000000000000000000000000000000000000000"),
                  topicForAddress(otherAddress),
                ],
                data: encodeBatchData([1n, 2n], [3n, 5n]),
              },
              {
                address: contract,
                blockNumber: "0x12a7b85",
                transactionHash: "0x" + "3".repeat(64),
                logIndex: "0x2",
                topics: [
                  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
                  topicForAddress(otherAddress),
                  topicForAddress(otherAddress),
                  topicForAddress(trackedAddress),
                ],
                data: `0x${encodeWord(1n)}${encodeWord(1n)}`,
              },
            ],
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      `http://example.com/api/erc1155/export?fromBlock=19557347&toBlock=19557349&address=${trackedAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      contract: string;
      address: string;
      tokenId: string;
      type: string;
      count: number;
      results: Array<{
        eventType: string;
        tokenId: string;
        value: string;
        to: string;
      }>;
    };
    expect(body.contract).toBe(contract);
    expect(body.address).toBe(trackedAddress);
    expect(body.tokenId).toBe("1");
    expect(body.type).toBe("mints");
    expect(body.count).toBe(2);
    expect(body.results).toEqual([
      expect.objectContaining({
        eventType: "mint",
        tokenId: "1",
        value: "1",
        to: trackedAddress,
      }),
      expect.objectContaining({
        eventType: "mint",
        tokenId: "1",
        value: "3",
        to: otherAddress,
      }),
    ]);
  });

  it("supports CSV output for Ethereum transfers", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: [
              {
                address: contract,
                blockNumber: "0x12a7b90",
                transactionHash: "0x" + "4".repeat(64),
                logIndex: "0x3",
                topics: [
                  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
                  topicForAddress(trackedAddress),
                  topicForAddress(trackedAddress),
                  topicForAddress(otherAddress),
                ],
                data: `0x${encodeWord(1n)}${encodeWord(2n)}`,
              },
            ],
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      `http://example.com/api/erc1155/export?fromBlock=19557360&toBlock=19557360&address=${trackedAddress}&type=transfers&format=csv`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    await expect(response.text()).resolves.toContain(
      `,transfer,${trackedAddress},${trackedAddress},${otherAddress},1,2`
    );
  });

  it("returns 400 for an invalid participant Ethereum address", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/erc1155/export?fromBlock=1&toBlock=2&address=not-an-address"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid participant address",
    });
  });

  it("returns 400 when the requested block span is too large", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/erc1155/export?fromBlock=1&toBlock=20002"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Block range too large. Maximum span is 20000 blocks",
    });
  });

  it("ignores malformed batch payloads safely", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: [
              {
                address: contract,
                blockNumber: "0x12a7b84",
                transactionHash: "0x" + "5".repeat(64),
                logIndex: "0x1",
                topics: [
                  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb",
                  topicForAddress(trackedAddress),
                  topicForAddress("0x0000000000000000000000000000000000000000"),
                  topicForAddress(otherAddress),
                ],
                data: `0x${encodeWord(64n)}${encodeWord(128n)}${encodeWord(999999n)}`,
              },
            ],
          }),
          { status: 200 }
        )
    );

    const request = new IncomingRequest(
      "http://example.com/api/erc1155/export?fromBlock=19557347&toBlock=19557347&type=all"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      count: 0,
      results: [],
    });
  });

  it("returns 502 when the Ethereum RPC provider is unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Network error");
    });

    const request = new IncomingRequest(
      `http://example.com/api/erc1155/export?fromBlock=19557347&toBlock=19557347&address=${trackedAddress}`
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeExportEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to reach Ethereum RPC provider",
    });
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

  it("returns 500 when the receiving wallet is misconfigured", async () => {
    const request = new IncomingRequest("http://example.com/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", payer_address: validPayerAddress }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      request,
      {
        ...makePayEnv(),
        RECEIVING_WALLET: "not-an-address",
      } as Env,
      ctx
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Receiving wallet is misconfigured",
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

  it("returns 500 when the receiving wallet is misconfigured", async () => {
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
      {
        ...makeActivateEnv(),
        RECEIVING_WALLET: "bad-wallet",
      } as Env,
      ctx
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Receiving wallet is misconfigured",
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
