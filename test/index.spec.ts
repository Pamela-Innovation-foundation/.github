import {
  SELF,
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const TEST_API_KEY = "test-api-key-12345";

async function seedTestDb() {
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)"
    ),
    env.DB.prepare("DELETE FROM Customers"),
    env.DB.prepare(
      "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
    ).bind(11, "Bs Beverages", "Victoria Ashworth"),
    env.DB.prepare(
      "INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)"
    ).bind(13, "Bs Beverages", "Random Name"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS Landmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL)"
    ),
    env.DB.prepare("DELETE FROM Landmarks"),
    env.DB.prepare(
      "INSERT INTO Landmarks (name, location, description, created_at) VALUES (?, ?, ?, ?)"
    ).bind(
      "Ram Mandir",
      "Ayodhya, India",
      "A grand Hindu temple inaugurated in January 2024.",
      "2024-01-22"
    ),
    env.DB.prepare(
      "INSERT INTO Landmarks (name, location, description, created_at) VALUES (?, ?, ?, ?)"
    ).bind(
      "Grand Egyptian Museum",
      "Giza, Egypt",
      "The largest archaeological museum in the world.",
      "2024-06-01"
    ),
  ]);
}

beforeAll(async () => {
  await seedTestDb();
});

describe("D1 Beverages Worker", () => {
  it("returns the root help text (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
      DB: env.DB,
    } as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("/api/beverages");
  });

  it("returns the clock page (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/clock");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Digital Clock");
    expect(body).toContain('id="clocks"');
    expect(body).toContain("setInterval(tick, 1000)");
  });

  it("rejects beverages requests without an API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - Invalid or missing API key",
    });
  });

  it("returns beverage rows with a valid API key", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages", {
      headers: { "X-API-Key": TEST_API_KEY },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    await expect(response.json()).resolves.toEqual([
      {
        CompanyName: "Bs Beverages",
        ContactName: "Victoria Ashworth",
        CustomerId: 11,
      },
      {
        CompanyName: "Bs Beverages",
        ContactName: "Random Name",
        CustomerId: 13,
      },
    ]);
  });
});

describe("Landmarks API", () => {
  it("returns unauthorized without API key (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/landmarks");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - Invalid or missing API key",
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
    request.headers.set("X-API-Key", TEST_API_KEY);
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = (await response.json()) as { landmarks: typeof mockResults };
    expect(body.landmarks).toEqual(mockResults);
  });

  it("filters landmarks in integration requests", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=2024-05-01",
      {
        headers: { "X-API-Key": TEST_API_KEY },
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      landmarks: Array<{ name: string; created_at: string }>;
    };
    expect(body.landmarks).toEqual([
      {
        id: 2,
        name: "Grand Egyptian Museum",
        location: "Giza, Egypt",
        description: "The largest archaeological museum in the world.",
        created_at: "2024-06-01",
      },
    ]);
  });

  it("uses the default since date when no query param is provided", async () => {
    let boundValue: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (value: string) => {
          boundValue = value;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest("http://example.com/api/landmarks");
    request.headers.set("X-API-Key", TEST_API_KEY);
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(boundValue).toBe("2024-01-01");
  });

  it("accepts a custom since query parameter", async () => {
    let boundValue: string | undefined;
    const mockDB = {
      prepare: () => ({
        bind: (value: string) => {
          boundValue = value;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/landmarks?since=2024-06-01"
    );
    request.headers.set("X-API-Key", TEST_API_KEY);
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(boundValue).toBe("2024-06-01");
  });

  it("rejects an invalid since query parameter", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=not-a-date",
      {
        headers: { "X-API-Key": TEST_API_KEY },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid since parameter",
    });
  });

  it("returns 500 on database error", async () => {
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
    request.headers.set("X-API-Key", TEST_API_KEY);
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: TEST_API_KEY,
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
