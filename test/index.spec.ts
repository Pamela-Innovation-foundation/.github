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
    // Initialize the database with test data
    // Use batch for better performance with multiple inserts
    await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)`
    );

    // Use batch() for efficient multiple inserts
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(1, "Alfreds Futterkiste", "Maria Anders"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(4, "Around the Horn", "Thomas Hardy"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(11, "Bs Beverages", "Victoria Ashworth"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(13, "Bs Beverages", "Random Name"),
    ]);
  });

  it("responds with default message for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    // Create an empty context to pass to `worker.fetch()`.
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("responds with default message for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("returns beverages data from database (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/beverages");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]).toHaveProperty("CompanyName", "Bs Beverages");
    expect(data[0]).toHaveProperty("ContactName");
    expect(data[0]).toHaveProperty("CustomerId");
  });

  it("returns beverages data from database (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });
});

describe("KV Key-Value Store", () => {
  it("sets a key-value pair (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "testKey", value: "testValue" }),
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true, key: "testKey", value: "testValue" });
  });

  it("sets a key-value pair (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "integrationKey",
        value: "integrationValue",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      key: "integrationKey",
      value: "integrationValue",
    });
  });

  it("retrieves a value by key (unit style)", async () => {
    // First set a key
    await env.KV.put("retrieveTest", "retrieveValue");

    const request = new IncomingRequest(
      "http://example.com/api/keys/retrieveTest"
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ key: "retrieveTest", value: "retrieveValue" });
  });

  it("retrieves a value by key (integration style)", async () => {
    // First set a key
    await env.KV.put("integrationRetrieveTest", "integrationRetrieveValue");

    const response = await SELF.fetch(
      "https://example.com/api/keys/integrationRetrieveTest"
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      key: "integrationRetrieveTest",
      value: "integrationRetrieveValue",
    });
  });

  it("returns 404 for non-existent key", async () => {
    const request = new IncomingRequest(
      "http://example.com/api/keys/nonExistentKey"
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Key not found" });
  });

  it("returns 400 when key or value is missing", async () => {
    const request = new IncomingRequest("http://example.com/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "testKey" }), // missing value
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Both key and value are required" });
  });

  it("returns 400 when key is empty string", async () => {
    const request = new IncomingRequest("http://example.com/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "", value: "testValue" }), // empty key
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Both key and value are required" });
  });

  it("returns 400 when key is only whitespace", async () => {
    const request = new IncomingRequest("http://example.com/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "   ", value: "testValue" }), // whitespace key
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Both key and value are required" });
  });
});
