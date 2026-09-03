export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Handle blockchain webhook endpoint
    if (pathname === "/webhook" && request.method === "POST") {
      try {
        // Parse the incoming JSON webhook data
        const webhookData = await request.json();

        // Store the webhook data in D1 database
        const timestamp = new Date().toISOString();
        const dataJson = JSON.stringify(webhookData);

        // Insert webhook data into the database
        const result = await env.DB.prepare(
          "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
        )
          .bind(dataJson, timestamp)
          .run();

        // Return success response with 'pamela' included
        return Response.json(
          {
            success: true,
            message: "Blockchain webhook received and stored for pamela",
            webhookId: result.meta.last_row_id,
            timestamp: timestamp,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error("Failed to process blockchain webhook:", error);
        return Response.json(
          {
            success: false,
            error: "Failed to process blockchain webhook for pamela",
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    }

    // Handle non-POST requests to webhook endpoint
    if (pathname === "/webhook" && request.method !== "POST") {
      return Response.json(
        {
          error: "Method not allowed. Only POST requests are accepted.",
        },
        { status: 405 }
      );
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
