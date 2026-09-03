// test/index.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
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

  it("returns digital clock page for /clock", async () => {
    const response = await SELF.fetch("https://example.com/clock");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Digital Clock");
  });

  it("returns clock with no rewind offset when no param given", async () => {
    const response = await SELF.fetch("https://example.com/clock");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("const REWIND_MS = 0;");
  });

  it("returns clock with correct rewind offset for ?rewind=3600", async () => {
    const response = await SELF.fetch("https://example.com/clock?rewind=3600");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("const REWIND_MS = 3600000;");
    expect(html).toContain("rewound");
  });

  it("returns clock with correct rewind offset for ?rewind=0", async () => {
    const response = await SELF.fetch("https://example.com/clock?rewind=0");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("const REWIND_MS = 0;");
  });

  it("returns 400 for negative rewind value", async () => {
    const response = await SELF.fetch("https://example.com/clock?rewind=-60");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "rewind must be a non-negative integer (seconds)",
    });
  });

  it("returns 400 for non-numeric rewind value", async () => {
    const response = await SELF.fetch("https://example.com/clock?rewind=abc");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "rewind must be a non-negative integer (seconds)",
    });
  });

  it("caps rewind at 1 year (unit style)", async () => {
    const request = new IncomingRequest(
      "http://example.com/clock?rewind=999999999"
    );
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const html = await response.text();
    // MAX_REWIND_SECONDS = 86400 * 365 = 31536000, so REWIND_MS = 31536000000
    expect(html).toContain("const REWIND_MS = 31536000000;");
  });
});
