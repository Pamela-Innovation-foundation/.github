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
    const request = new IncomingRequest(
      "http://example.com/api/landmarks"
    );
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

    const request = new IncomingRequest(
      "http://example.com/api/landmarks"
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

    const request = new IncomingRequest(
      "http://example.com/api/landmarks"
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

    const request = new IncomingRequest(
      "http://example.com/api/landmarks"
    );
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

describe("Landmarks API - integration style", () => {
  beforeAll(async () => {
    await env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS Landmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      ),
      env.DB.prepare(
        "INSERT INTO Landmarks (name, location, description, created_at) VALUES (?, ?, ?, ?)"
      ).bind(
        "Grand Egyptian Museum",
        "Giza, Egypt",
        "The largest archaeological museum in the world.",
        "2024-06-01"
      ),
      env.DB.prepare(
        "INSERT INTO Landmarks (name, location, description, created_at) VALUES (?, ?, ?, ?)"
      ).bind(
        "Ram Mandir",
        "Ayodhya, India",
        "A grand Hindu temple inaugurated in January 2024.",
        "2024-01-22"
      ),
    ]);
  });

  it("returns 401 without API key", async () => {
    const response = await SELF.fetch("https://example.com/api/landmarks");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns all landmarks seeded from source", async () => {
    const response = await SELF.fetch("https://example.com/api/landmarks", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      landmarks: {
        id: number;
        name: string;
        location: string;
        description: string | null;
        created_at: string;
      }[];
    };
    expect(Array.isArray(body.landmarks)).toBe(true);
    expect(body.landmarks.length).toBe(2);
    expect(body.landmarks.map((l) => l.name)).toContain("Grand Egyptian Museum");
    expect(body.landmarks.map((l) => l.name)).toContain("Ram Mandir");
  });

  it("filters landmarks by since query parameter", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=2024-06-01",
      {
        headers: { "X-API-Key": "test-api-key-12345" },
      }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      landmarks: { name: string; created_at: string }[];
    };
    expect(body.landmarks.length).toBe(1);
    expect(body.landmarks[0].name).toBe("Grand Egyptian Museum");
  });

  it("returns all landmarks when clock is rewound to an early since date", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/landmarks?since=2000-01-01T00:00:00",
      {
        headers: { "X-API-Key": "test-api-key-12345" },
      }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      landmarks: { name: string; created_at: string }[];
    };
    expect(body.landmarks.length).toBe(2);
  });
});
