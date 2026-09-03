export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === "/api/landmarks") {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      const sinceParam = searchParams.get("since");
      const VALID_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;
      if (sinceParam !== null && !VALID_DATE_RE.test(sinceParam)) {
        return Response.json(
          { error: "Invalid 'since' parameter: expected YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS" },
          { status: 400 }
        );
      }
      const since = sinceParam ?? "2024-01-01T00:00:00";

      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ?"
        )
          .bind(since)
          .all();

        return Response.json(
          { landmarks: results },
          { headers: { "Cache-Control": "public, max-age=60" } }
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
