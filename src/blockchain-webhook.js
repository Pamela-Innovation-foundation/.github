/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests
 * Compatible with Wrangler 4.105.0 and Node.js 22+
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
 *
 * Authentication: All requests must include the X-API-Key header.
 * Set the key with: wrangler secret put API_KEY
 *
 * Endpoint: POST /webhook/blockchain
 *   Headers: X-API-Key: <your-api-key>
 *   Body: JSON payload from your blockchain provider
 *   Response 200: { success: true, id: <row-id> }
 */

export default {
  async fetch(request, env, _ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/webhook/blockchain") {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      let data;
      try {
        data = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      // UTC timestamp, stored without timezone suffix (consistent with other tables)
      const timestamp = new Date()
        .toISOString()
        .replace("T", " ")
        .split(".")[0];
      try {
        const result = await env.DB.prepare(
          "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
        )
          .bind(JSON.stringify(data), timestamp)
          .run();
        return Response.json({ success: true, id: result.meta.last_row_id });
      } catch (error) {
        console.error("Failed to store webhook event:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
