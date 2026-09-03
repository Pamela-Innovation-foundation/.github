export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

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

    if (pathname === "/api/pull" && request.method === "POST") {
      try {
        // Re-initialize database with schema data
        await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
        await env.DB.exec(`CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)`);
        
        // Use batch for efficient multiple inserts
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(1, 'Alfreds Futterkiste', 'Maria Anders'),
          env.DB.prepare(`INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(4, 'Around the Horn', 'Thomas Hardy'),
          env.DB.prepare(`INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(11, 'Bs Beverages', 'Victoria Ashworth'),
          env.DB.prepare(`INSERT INTO Customers (CustomerId, CompanyName, ContactName) VALUES (?, ?, ?)`).bind(13, 'Bs Beverages', 'Random Name')
        ]);
        
        return Response.json({
          success: true,
          message: "Database refreshed successfully"
        });
      } catch (error) {
        console.error("Database refresh failed:", error);
        return Response.json(
          { error: "Failed to refresh database" },
          { status: 500 }
        );
      }
    }

    return new Response(
      "Call /api/beverages to see everyone who works at Bs Beverages"
    );
  },
} satisfies ExportedHandler<Env>;
