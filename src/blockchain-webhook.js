/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests
 * Compatible with Wrangler 4.62.0 and Node.js 20+
 */

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // Only handle POST requests to the webhook endpoint
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
            details: error.message,
          },
          { status: 500 }
        );
      }
    }

    // Handle non-POST requests or other paths
    if (pathname === "/webhook" && request.method !== "POST") {
      return Response.json(
        {
          error: "Method not allowed. Only POST requests are accepted.",
        },
        { status: 405 }
      );
    }

    // Default response for other paths
    return new Response(
      "Blockchain Webhook Handler - POST to /webhook to submit blockchain data for pamela"
    );
  },
};
