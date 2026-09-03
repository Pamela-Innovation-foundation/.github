export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // GET /api/keys/:key - retrieve value by key
    const keyMatch = pathname.match(/^\/api\/keys\/(.+)$/);
    if (keyMatch && request.method === "GET") {
      const key = keyMatch[1];
      try {
        const value = await env.KV.get(key);
        if (value === null) {
          return Response.json({ error: "Key not found" }, { status: 404 });
        }
        return Response.json({ key, value });
      } catch (error) {
        console.error("KV get failed:", error);
        return Response.json(
          { error: "Failed to retrieve key" },
          { status: 500 }
        );
      }
    }

    // POST /api/keys - set key-value pair
    if (pathname === "/api/keys" && request.method === "POST") {
      try {
        const body = (await request.json()) as { key?: string; value?: string };
        const { key, value } = body;

        if (!key || key.trim() === "" || value === undefined) {
          return Response.json(
            { error: "Both key and value are required" },
            { status: 400 }
          );
        }

        await env.KV.put(key, String(value));
        return Response.json({ success: true, key, value });
      } catch (error) {
        console.error("KV put failed:", error);
        return Response.json({ error: "Failed to set key" }, { status: 500 });
      }
    }

    if (pathname === "/api/beverages") {
      try {
        // Optimized: Select only needed columns instead of SELECT *
        // This reduces data transfer and improves query performance
        const { results } = await env.DB.prepare(
          "SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?"
        )
          .bind("Bs Beverages")
          .all();

        // Add cache headers for better performance
        return Response.json(results, {
          headers: {
            "Cache-Control": "public, max-age=60",
          },
        });
      } catch (error) {
        // Proper error handling for database failures
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Failed to fetch beverages data" },
          { status: 500 }
        );
      }
    }

    return new Response(
      "Call /api/beverages to see everyone who works at Bs Beverages"
    );
  },
} satisfies ExportedHandler<Env>;
