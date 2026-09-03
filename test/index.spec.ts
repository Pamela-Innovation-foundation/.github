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

  it("returns unauthorized for non-api routes", async () => {
    const response = await SELF.fetch("https://example.com/clock");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - interaction is disabled",
    });
  });
});

describe("Customers API", () => {
  it("returns unauthorized without API key (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/customers");
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

  it("returns customers from the database (unit style)", async () => {
    const mockResults = [
      {
        CustomerId: 1,
        CompanyName: "Alfreds Futterkiste",
        ContactName: "Maria Anders",
      },
      {
        CustomerId: 11,
        CompanyName: "Bs Beverages",
        ContactName: "Victoria Ashworth",
      },
    ];

    const mockDB = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: mockResults }),
        }),
      }),
    };

    const request = new IncomingRequest("http://example.com/api/customers");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      customers: typeof mockResults;
      limit: number;
      offset: number;
    };
    expect(body.customers).toEqual(mockResults);
  });

  it("uses default limit=20 and offset=0 (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest("http://example.com/api/customers");
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(boundArgs).toEqual([20, 0]);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("respects custom limit and offset query params (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/customers?limit=5&offset=10"
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
    expect(boundArgs).toEqual([5, 10]);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  it("caps limit at 100 (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/customers?limit=9999"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(boundArgs[0]).toBe(100);
  });

  it("falls back to defaults for invalid pagination params (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/customers?limit=-5&offset=invalid"
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
    expect(boundArgs).toEqual([20, 0]);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("returns 405 for non-GET requests (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/customers", {
      method: "POST",
    });
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
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

    const request = new IncomingRequest("http://example.com/api/customers");
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

  it("uses default limit=20 and offset=0 (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
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
    expect(boundArgs[1]).toBe(20);
    expect(boundArgs[2]).toBe(0);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("respects custom limit and offset query params (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/landmarks?limit=3&offset=6"
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
    expect(boundArgs[1]).toBe(3);
    expect(boundArgs[2]).toBe(6);
  });

  it("caps limit at 100 (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/landmarks?limit=9999"
    );
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: mockDB,
    } as unknown as Env;
    await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(boundArgs[1]).toBe(100);
  });

  it("falls back to defaults for invalid pagination params (unit style)", async () => {
    let boundArgs: unknown[] = [];
    const mockDB = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    };

    const request = new IncomingRequest(
      "http://example.com/api/landmarks?limit=0&offset=invalid"
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
    expect(boundArgs[1]).toBe(20);
    expect(boundArgs[2]).toBe(0);
    const body = (await response.json()) as { limit: number; offset: number };
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("returns 405 for non-GET requests (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/landmarks", {
      method: "POST",
    });
    request.headers.set("X-API-Key", "test-api-key-12345");
    const ctx = createExecutionContext();
    const mockEnv = {
      API_KEY: "test-api-key-12345",
      DB: undefined,
    } as unknown as Env;
    const response = await worker.fetch(request, mockEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
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
