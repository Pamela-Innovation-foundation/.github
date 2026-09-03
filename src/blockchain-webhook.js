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

import { handleWebhookRequest } from "./handle-webhook.js";

export default {
  async fetch(request, env, _ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/webhook") {
      // Require API key authentication
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      return handleWebhookRequest(request, env);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
