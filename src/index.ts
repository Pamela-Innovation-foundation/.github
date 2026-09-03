const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function addSecurityHeaders(headers: Record<string, string>): Record<string, string> {
  return { ...SECURITY_HEADERS, ...headers };
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/beverages") {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed" },
          {
            status: 405,
            headers: addSecurityHeaders({ Allow: "GET" }),
          }
        );
      }

      try {
        // Optimized: Select only needed columns instead of SELECT *
        // This reduces data transfer and improves query performance
        const { results } = await env.DB.prepare(
          "SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?"
        )
          .bind("Bs Beverages")
          .all();

        return Response.json(results, {
          headers: addSecurityHeaders({ "Cache-Control": "public, max-age=60" }),
        });
      } catch (error) {
        // Proper error handling for database failures
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Failed to fetch beverages data" },
          { status: 500, headers: SECURITY_HEADERS }
        );
      }
    }

    if (pathname === "/") {
      return new Response(
        "Call /api/beverages to see everyone who works at Bs Beverages",
        { headers: SECURITY_HEADERS }
      );
    }

    return Response.json(
      { error: "Not found" },
      { status: 404, headers: SECURITY_HEADERS }
    );
  },
} satisfies ExportedHandler<Env>;
