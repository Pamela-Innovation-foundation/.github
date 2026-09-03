export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/landmarks") {
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      const sinceDate = url.searchParams.get("since") ?? "2024-01-01T00:00:00";

      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ? ORDER BY created_at ASC"
        )
          .bind(sinceDate)
          .all();

        return Response.json({ landmarks: results });
      } catch {
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
