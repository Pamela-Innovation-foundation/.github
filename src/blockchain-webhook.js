/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests
 * Compatible with Wrangler 4.62.0 and Node.js 20+
 * 
 * This webhook handler receives blockchain event notifications from services like:
 * - Alchemy (Ethereum, Polygon, etc.)
 * - Infura (Ethereum infrastructure)
 * - Moralis (Web3 platform)
 * - QuickNode (Multi-chain nodes)
 * 
 * Common use cases:
 * - Track Ethereum (ETH) transactions
 * - Monitor smart contract events
 * - Process on-chain activity in real-time
 * - Store blockchain data for analytics
 * 
 * For more information about "Open ETH" and Ethereum integration,
 * see BLOCKCHAIN_GUIDE.md in the project root.
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

        // Note: Do not close the D1 database connection manually.
        // Cloudflare Workers runtime automatically manages the connection lifecycle.

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
