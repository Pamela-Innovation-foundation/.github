/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests
 * Compatible with Wrangler 4.62.0; local development requires Node.js >=20.18.1 (Cloudflare Workers runtime requirements differ)
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
  async fetch(_request, _env) {
    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
};
