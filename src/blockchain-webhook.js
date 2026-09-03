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
 *
 * Security: Incoming POST requests must include a valid HMAC-SHA256 signature
 * in the `X-Webhook-Signature` header (hex-encoded, keyed with WEBHOOK_SECRET).
 * Duplicate deliveries are rejected using the `Webhook-ID` header.
 */

/**
 * Verify an HMAC-SHA256 signature against the raw request body.
 * @param {string} secret  - The WEBHOOK_SECRET value from env
 * @param {string} body    - The raw request body string
 * @param {string} sigHex  - The hex-encoded signature from the request header
 * @returns {Promise<boolean>}
 */
async function verifyHmacSignature(secret, body, sigHex) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Normalize: trim whitespace and strip optional 0x prefix
  const normalized = sigHex.trim().replace(/^0x/i, "");
  // Validate: must be a non-empty, even-length hex string
  if (normalized.length === 0 || normalized.length % 2 !== 0) return false;
  if (!/^[0-9a-fA-F]+$/.test(normalized)) return false;
  // Convert hex signature to Uint8Array
  const sigBytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    sigBytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }

  return crypto.subtle.verify("HMAC", cryptoKey, sigBytes, msgData);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // Handle non-POST requests to /webhook
    if (pathname === "/webhook" && request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed. Only POST requests are accepted." },
        { status: 405 }
      );
    }

    // Only handle POST requests to the webhook endpoint
    if (pathname === "/webhook" && request.method === "POST") {
      // --- 1. HMAC signature verification ---
      if (env.WEBHOOK_SECRET) {
        const sigHeader = request.headers.get("X-Webhook-Signature");
        if (!sigHeader) {
          return Response.json(
            { error: "Unauthorized - missing signature" },
            { status: 401 }
          );
        }
        // Read raw body for signature verification (clone so we can parse JSON later)
        const rawBody = await request.text();
        const valid = await verifyHmacSignature(
          env.WEBHOOK_SECRET,
          rawBody,
          sigHeader
        );
        if (!valid) {
          return Response.json(
            { error: "Unauthorized - invalid signature" },
            { status: 401 }
          );
        }
        // Replace request with one we can still parse as JSON
        request = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: rawBody,
        });
      }

      // --- 2. Deduplication by Webhook-ID header (handled atomically in INSERT OR IGNORE below) ---
      const webhookId = request.headers.get("Webhook-ID");

      // Parse the incoming JSON webhook data
      let webhookData;
      try {
        webhookData = await request.json();
      } catch (parseError) {
        console.error("Failed to process blockchain webhook: invalid JSON", parseError);
        return Response.json(
          {
            success: false,
            error: "Failed to process blockchain webhook for pamela",
          },
          { status: 500 }
        );
      }

      try {
        const timestamp = new Date().toISOString();
        const dataJson = JSON.stringify(webhookData);

        // Atomic insert: INSERT OR IGNORE handles concurrent duplicate deliveries safely.
        // If webhook_id already exists the unique index prevents double-insertion;
        // meta.changes === 0 means this was a duplicate — acknowledge and drop.
        const result = await env.DB.prepare(
          "INSERT OR IGNORE INTO BlockchainWebhooks (data, timestamp, webhook_id) VALUES (?, ?, ?)"
        )
          .bind(dataJson, timestamp, webhookId ?? null)
          .run();

        if (result.meta.changes === 0 && webhookId) {
          return Response.json(
            {
              success: true,
              message: "Duplicate webhook ignored for pamela",
            },
            { status: 200 }
          );
        }

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
          },
          { status: 500 }
        );
      }
    }

    // Default response for other paths
    return new Response(
      "Blockchain Webhook Handler - POST to /webhook to submit blockchain data for pamela"
    );
  },
};
