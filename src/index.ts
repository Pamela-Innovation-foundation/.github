import { handleWebhookRequest } from "./handle-webhook.js";

function parseBoundedPositiveInteger(
  value: string | null,
  defaultValue: number,
  maxValue: number
): number {
  if (value === null) {
    return defaultValue;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  return Math.min(parsedValue, maxValue);
}

function parseNonNegativeInteger(
  value: string | null,
  defaultValue: number
): number {
  if (value === null) {
    return defaultValue;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return defaultValue;
  }

  return parsedValue;
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    // API key authentication for protected endpoints
    if (pathname.startsWith("/api/")) {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }
    }

    if (pathname === "/api/webhook") {
      return handleWebhookRequest(request, env);
    }

    if (pathname === "/api/customers") {
      if (request.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const limit = parseBoundedPositiveInteger(
        searchParams.get("limit"),
        20,
        100
      );
      const offset = parseNonNegativeInteger(searchParams.get("offset"), 0);
      try {
        const { results } = await env.DB.prepare(
          "SELECT CustomerId, CompanyName, ContactName FROM Customers LIMIT ? OFFSET ?"
        )
          .bind(limit, offset)
          .all();

        return Response.json(
          { customers: results, limit, offset },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      } catch (error) {
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    if (pathname === "/api/landmarks") {
      if (request.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const since = searchParams.get("since") ?? "2024-01-01T00:00:00";
      const limit = parseBoundedPositiveInteger(
        searchParams.get("limit"),
        20,
        100
      );
      const offset = parseNonNegativeInteger(searchParams.get("offset"), 0);
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ? LIMIT ? OFFSET ?"
        )
          .bind(since, limit, offset)
          .all();

        return Response.json(
          { landmarks: results, limit, offset },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      } catch (error) {
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
