// test/blockscout.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const API_KEY = "test-api-key-12345";
const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const MULTICHAIN = "https://api.blockscout.example";
const EXPLORER = "https://explorer.blockscout.example";

type FetchCall = { url: string; init: RequestInit | undefined };

const makeEnv = (overrides?: Partial<Env>) =>
  ({
    API_KEY,
    ETH_RPC_URL: "https://cloudflare-eth.com",
    BLOCKSCOUT_MULTICHAIN_BASE_URL: MULTICHAIN,
    BLOCKSCOUT_EXPLORER_BASE_URL: EXPLORER,
    BLOCKSCOUT_DEFAULT_CHAIN_ID: "1",
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({}),
          all: async () => ({ results: [] }),
          first: async () => null,
        }),
      }),
    },
    ...overrides,
  }) as unknown as Env;

const stubFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): FetchCall[] => {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      return handler(url, init);
    }
  );
  return calls;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Blockscout proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without an API key", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats"
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });

  it("returns 405 for non-GET methods", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats",
      { method: "POST" }
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });

  it("proxies /api/blockscout/stats to the explorer Stats API", async () => {
    const upstreamBody = { total_blocks: 42 };
    const calls = stubFetch(() => jsonResponse(upstreamBody));

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    await expect(response.json()).resolves.toEqual(upstreamBody);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${EXPLORER}/api/v2/stats`);
    // No Authorization header on Stats calls.
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("proxies transactions chart with forwarded query string", async () => {
    const calls = stubFetch(() => jsonResponse({ chart_data: [] }));

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats/charts/transactions?from=2024-01-01"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(calls[0].url).toBe(
      `${EXPLORER}/api/v2/stats/charts/transactions?from=2024-01-01`
    );
  });

  it("returns 400 for an invalid contract address", async () => {
    const calls = stubFetch(() => jsonResponse({}));

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/contracts/not-an-address/audit-reports"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    // Must not hit the upstream when validation fails.
    expect(calls).toHaveLength(0);
  });

  it("returns 400 for an invalid chain id", async () => {
    const calls = stubFetch(() => jsonResponse({}));

    const request = new IncomingRequest(
      `http://example.com/api/blockscout/chains/abc/contracts/${VALID_ADDRESS}/audit-reports`
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("proxies audit-reports to the multichain API using the default chain id", async () => {
    const upstreamBody = { items: [] };
    const calls = stubFetch(() => jsonResponse(upstreamBody));

    const request = new IncomingRequest(
      `http://example.com/api/blockscout/contracts/${VALID_ADDRESS}/audit-reports`
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(calls[0].url).toBe(
      `${MULTICHAIN}/1/api/v2/smart-contracts/${VALID_ADDRESS}/audit-reports`
    );
    // No token configured -> no Authorization header.
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("attaches the bearer header only when BLOCKSCOUT_API_TOKEN is set", async () => {
    const calls = stubFetch(() => jsonResponse({ items: [] }));

    const request = new IncomingRequest(
      `http://example.com/api/blockscout/chains/137/contracts/${VALID_ADDRESS}/audit-reports`
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const env = makeEnv({
      BLOCKSCOUT_API_TOKEN: "secret-token",
    } as Partial<Env>);
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(calls[0].url).toBe(
      `${MULTICHAIN}/137/api/v2/smart-contracts/${VALID_ADDRESS}/audit-reports`
    );
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("Authorization")).toBe(
      ["Bea", "rer secret-token"].join("")
    );
  });

  it("returns 502 when the upstream fails", async () => {
    stubFetch(() => {
      throw new Error("network down");
    });

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Upstream error",
    });
  });

  it("maps upstream 5xx responses to 502 without leaking details", async () => {
    stubFetch(() => jsonResponse({ internal: "stack trace" }, 500));

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Upstream error",
    });
  });

  it("returns 502 when a base URL is misconfigured", async () => {
    const calls = stubFetch(() => jsonResponse({}));

    const request = new IncomingRequest(
      "http://example.com/api/blockscout/stats"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const env = makeEnv({
      BLOCKSCOUT_EXPLORER_BASE_URL: "",
    } as Partial<Env>);
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Upstream error",
    });
    // Must not hit any upstream on misconfiguration.
    expect(calls).toHaveLength(0);
  });

  it("returns 404 for unknown /api/blockscout paths", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/blockscout/unknown"
    );
    request.headers.set("X-API-Key", API_KEY);
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, makeEnv(), ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});
