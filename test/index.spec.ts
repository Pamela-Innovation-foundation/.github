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
});
