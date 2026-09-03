// test/index.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("D1 Beverages Worker", () => {
  beforeAll(async () => {
    await env.DB.exec("DROP TABLE IF EXISTS Customers");
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)"
    );

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
      ).bind(1, "Alfreds Futterkiste", "Maria Anders"),
      env.DB.prepare(
        "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
      ).bind(4, "Around the Horn", "Thomas Hardy"),
      env.DB.prepare(
        "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
      ).bind(11, "Bs Beverages", "Victoria Ashworth"),
      env.DB.prepare(
        "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
      ).bind(13, "Bs Beverages", "Random Name"),
    ]);
  });

  it("responds with default message for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    await expect(response.text()).resolves.toBe(
      "Call /api/beverages to see everyone who works at Bs Beverages"
    );
  });

  it("responds with default message for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    await expect(response.text()).resolves.toBe(
      "Call /api/beverages to see everyone who works at Bs Beverages"
    );
  });

  it("returns beverages data from database (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json<Array<Record<string, unknown>>>();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      CompanyName: "Bs Beverages",
    });
    expect(data[0]).toHaveProperty("ContactName");
    expect(data[0]).toHaveProperty("CustomerId");
  });

  it("returns beverages data from database (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json<Array<Record<string, unknown>>>();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
  });

  it("rejects requests without API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - Invalid or missing API key",
    });
  });

  it("rejects requests with invalid API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": "invalid-key" },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - Invalid or missing API key",
    });
  });
});
