import { handleWebhookRequest } from "./handle-webhook.js";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
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
      const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
      const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
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
      const since = searchParams.get("since") ?? "2024-01-01T00:00:00";
      const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
      const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
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
