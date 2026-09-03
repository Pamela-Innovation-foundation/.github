const WEI_PER_ETH = BigInt("1000000000000000000");
const MAX_HISTORY_RECORDS = 100;
const DEFAULT_ETH_RPC_URL = "https://cloudflare-eth.com";
// Maximum requests to unauthenticated endpoints per IP per minute (#4)
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Plan configuration: monthly request limit (-1 = unlimited) and price in wei
const PLANS: Record<string, { limit: number; priceWei: bigint }> = {
  starter: { limit: 1_000, priceWei: BigInt("1000000000000000") }, // 0.001 ETH
  pro: { limit: 10_000, priceWei: BigInt("10000000000000000") }, // 0.01 ETH
  enterprise: { limit: -1, priceWei: BigInt("100000000000000000") }, // 0.1 ETH
};

type ApiKeyRow = {
  id: number;
  plan: string;
  monthly_limit: number;
  usage_count: number;
  active: number;
};

// #4 — D1-backed rate limiter for unauthenticated endpoints.
// Returns true if the request should be blocked.
async function isRateLimited(ip: string, env: Env): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
    .toISOString()
    .replace("T", " ")
    .split(".")[0];
  try {
    type CountRow = { cnt: number };
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM RateLimitLog WHERE ip = ? AND requested_at >= ?"
    )
      .bind(ip, windowStart)
      .first<CountRow>();
    if (row && row.cnt >= RATE_LIMIT_MAX) {
      return true;
    }
    // Record this request (fire-and-forget; don't block on failure)
    env.DB.prepare(
      "INSERT INTO RateLimitLog (ip) VALUES (?)"
    )
      .bind(ip)
      .run()
      .catch((err) => console.error("RateLimitLog insert failed:", err));
  } catch (err) {
    // On DB error, fail open (allow the request)
    console.error("Rate limit check failed:", err);
  }
  return false;
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    // POST /pay — returns payment instructions for the requested plan
    if (pathname === "/pay" && request.method === "POST") {
      // #4 — rate-limit unauthenticated endpoint
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (await isRateLimited(ip, env)) {
        return Response.json(
          { error: "Too many requests - please try again later" },
          { status: 429 }
        );
      }

      let body: { plan?: string; payer_address?: string };
      try {
        body = (await request.json()) as {
          plan?: string;
          payer_address?: string;
        };
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      const { plan, payer_address } = body;
      if (!plan || !(plan in PLANS)) {
        return Response.json(
          { error: "Invalid plan. Valid options: starter, pro, enterprise" },
          { status: 400 }
        );
      }
      if (!payer_address || !/^0x[0-9a-fA-F]{40}$/.test(payer_address)) {
        return Response.json(
          { error: "Invalid payer Ethereum address" },
          { status: 400 }
        );
      }
      const planInfo = PLANS[plan];
      const remainder = planInfo.priceWei % WEI_PER_ETH;
      const amountEth = `${planInfo.priceWei / WEI_PER_ETH}.${remainder
        .toString()
        .padStart(18, "0")}`;
      return Response.json({
        receiving_address: env.RECEIVING_WALLET,
        amount_wei: planInfo.priceWei.toString(),
        amount_eth: amountEth,
        plan,
        payer_address,
        instructions: `Send exactly ${amountEth} ETH from ${payer_address} to ${env.RECEIVING_WALLET}, then POST /activate with your tx_hash, payer_address, and plan.`,
      });
    }

    // POST /activate — verifies an on-chain payment and provisions an API key
    if (pathname === "/activate" && request.method === "POST") {
      // #4 — rate-limit unauthenticated endpoint
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (await isRateLimited(ip, env)) {
        return Response.json(
          { error: "Too many requests - please try again later" },
          { status: 429 }
        );
      }

      let body: { tx_hash?: string; payer_address?: string; plan?: string };
      try {
        body = (await request.json()) as {
          tx_hash?: string;
          payer_address?: string;
          plan?: string;
        };
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      const { tx_hash, payer_address, plan } = body;
      if (!tx_hash || !/^0x[0-9a-fA-F]{64}$/.test(tx_hash)) {
        return Response.json(
          { error: "Invalid transaction hash" },
          { status: 400 }
        );
      }
      if (!payer_address || !/^0x[0-9a-fA-F]{40}$/.test(payer_address)) {
        return Response.json(
          { error: "Invalid payer Ethereum address" },
          { status: 400 }
        );
      }
      if (!plan || !(plan in PLANS)) {
        return Response.json({ error: "Invalid plan" }, { status: 400 });
      }

      // Reject if this tx_hash was already used to provision a key
      type TxRow = { id: number };
      let existingKey: TxRow | null;
      try {
        existingKey = await env.DB.prepare(
          "SELECT id FROM ApiKeys WHERE tx_hash = ?"
        )
          .bind(tx_hash)
          .first<TxRow>();
      } catch (err) {
        console.error("DB lookup failed:", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
      if (existingKey) {
        return Response.json(
          { error: "Transaction already used to provision a key" },
          { status: 409 }
        );
      }

      // Verify the transaction on-chain via JSON-RPC
      const rpcUrl = env.ETH_RPC_URL ?? DEFAULT_ETH_RPC_URL;
      type TxData = {
        to?: string | null;
        from?: string;
        value?: string;
        blockHash?: string | null;
      };
      type TxRpcResponse = {
        result?: TxData | null;
        error?: { message: string };
      };
      let txData: TxData | null = null;
      try {
        const rpcResp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionByHash",
            params: [tx_hash],
            id: 1,
          }),
        });
        if (!rpcResp.ok) {
          return Response.json(
            { error: "Failed to verify transaction" },
            { status: 502 }
          );
        }
        const rpcJson = (await rpcResp.json()) as TxRpcResponse;
        if (rpcJson.error || !rpcJson.result) {
          return Response.json(
            { error: "Transaction not found" },
            { status: 404 }
          );
        }
        txData = rpcJson.result;
      } catch (err) {
        console.error("RPC fetch failed:", err);
        return Response.json(
          { error: "Failed to reach Ethereum RPC provider" },
          { status: 502 }
        );
      }

      if (!txData) {
        return Response.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }
      if (!txData.blockHash) {
        return Response.json(
          { error: "Transaction is pending - please wait for confirmation" },
          { status: 202 }
        );
      }
      if (txData.from?.toLowerCase() !== payer_address.toLowerCase()) {
        return Response.json(
          { error: "Transaction sender does not match payer address" },
          { status: 400 }
        );
      }
      if (txData.to?.toLowerCase() !== env.RECEIVING_WALLET.toLowerCase()) {
        return Response.json(
          { error: "Transaction recipient does not match receiving wallet" },
          { status: 400 }
        );
      }
      const valueBig = BigInt(txData.value ?? "0x0");
      const planInfo = PLANS[plan];
      if (valueBig < planInfo.priceWei) {
        return Response.json(
          { error: "Transaction value is less than the required plan price" },
          { status: 400 }
        );
      }

      // Provision a new API key
      const apiKey = crypto.randomUUID();
      const resetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .split(".")[0];
      try {
        await env.DB.prepare(
          "INSERT INTO ApiKeys (key, plan, monthly_limit, usage_count, reset_at, active, tx_hash, payer_address) VALUES (?, ?, ?, 0, ?, 1, ?, ?)"
        )
          .bind(apiKey, plan, planInfo.limit, resetAt, tx_hash, payer_address)
          .run();
      } catch (err) {
        console.error("Failed to provision API key:", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }

      return Response.json(
        {
          api_key: apiKey,
          plan,
          monthly_limit: planInfo.limit === -1 ? "unlimited" : planInfo.limit,
          reset_at: resetAt,
          message:
            "API key provisioned. Include it as X-API-Key header in requests.",
        },
        { status: 201 }
      );
    }

    // API key authentication for protected endpoints
    let authedKeyRow: ApiKeyRow | null = null;
    if (pathname.startsWith("/api/")) {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      if (apiKey !== env.API_KEY) {
        // Not the admin key — look up in D1 ApiKeys table
        try {
          authedKeyRow = await env.DB.prepare(
            "SELECT id, plan, monthly_limit, usage_count, active FROM ApiKeys WHERE key = ?"
          )
            .bind(apiKey)
            .first<ApiKeyRow>();
        } catch (err) {
          console.error("ApiKey DB lookup failed:", err);
          return Response.json(
            { error: "Internal server error" },
            { status: 500 }
          );
        }
        if (!authedKeyRow || !authedKeyRow.active) {
          return Response.json(
            { error: "Unauthorized - invalid or missing API key" },
            { status: 401 }
          );
        }
        if (
          authedKeyRow.monthly_limit !== -1 &&
          authedKeyRow.usage_count >= authedKeyRow.monthly_limit
        ) {
          return Response.json(
            { error: "Monthly request limit exceeded" },
            { status: 429 }
          );
        }
        try {
          await env.DB.prepare(
            "UPDATE ApiKeys SET usage_count = usage_count + 1 WHERE id = ?"
          )
            .bind(authedKeyRow.id)
            .run();
        } catch (err) {
          console.error("Failed to increment usage count:", err);
        }
      }
    }

    // GET /api/usage — returns quota information for the current API key
    if (pathname === "/api/usage") {
      if (authedKeyRow) {
        return Response.json({
          plan: authedKeyRow.plan,
          usage_count: authedKeyRow.usage_count,
          monthly_limit:
            authedKeyRow.monthly_limit === -1
              ? "unlimited"
              : authedKeyRow.monthly_limit,
          remaining:
            authedKeyRow.monthly_limit === -1
              ? "unlimited"
              : Math.max(
                  0,
                  authedKeyRow.monthly_limit - authedKeyRow.usage_count
                ),
        });
      }
      return Response.json({
        plan: "admin",
        usage_count: null,
        monthly_limit: "unlimited",
        remaining: "unlimited",
      });
    }

    // #1 — GET /api/webhooks — returns stored blockchain webhook events
    if (pathname === "/api/webhooks" && request.method === "GET") {
      const limit = Math.min(
        parseInt(searchParams.get("limit") ?? "50", 10) || 50,
        MAX_HISTORY_RECORDS
      );
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, data, timestamp FROM BlockchainWebhooks ORDER BY timestamp DESC LIMIT ?"
        )
          .bind(limit)
          .all();

        return Response.json(
          { webhooks: results },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch (error) {
        console.error("Failed to fetch webhooks:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    // #6 — POST /api/webhooks/blockchain — ingest blockchain event (moved from blockchain-webhook.js)
    if (pathname === "/api/webhooks/blockchain" && request.method === "POST") {
      let data: unknown;
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

    if (
      pathname === "/api/webhooks/blockchain" &&
      request.method !== "POST"
    ) {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // #3 — DELETE /api/keys/:id — revoke an API key (admin only)
    const revokeMatch = pathname.match(/^\/api\/keys\/(\d+)$/);
    if (revokeMatch && request.method === "DELETE") {
      // Only the admin key may revoke
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - admin key required" },
          { status: 401 }
        );
      }
      const keyId = parseInt(revokeMatch[1], 10);
      try {
        const result = await env.DB.prepare(
          "UPDATE ApiKeys SET active = 0 WHERE id = ?"
        )
          .bind(keyId)
          .run();
        if (result.meta.changes === 0) {
          return Response.json({ error: "Key not found" }, { status: 404 });
        }
        return Response.json({ success: true, id: keyId, active: false });
      } catch (err) {
        console.error("Failed to revoke API key:", err);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    if (pathname === "/api/eth-balance") {
      const address = searchParams.get("address") ?? "";
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return Response.json(
          { error: "Invalid Ethereum address" },
          { status: 400 }
        );
      }

      const rpcUrl = env.ETH_RPC_URL ?? DEFAULT_ETH_RPC_URL;
      let rpcResponse: Response;
      try {
        rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1,
          }),
        });
      } catch (error) {
        console.error("ETH RPC fetch failed:", error);
        return Response.json(
          { error: "Failed to reach Ethereum RPC provider" },
          { status: 502 }
        );
      }

      if (!rpcResponse.ok) {
        console.error("ETH RPC returned non-OK status:", rpcResponse.status);
        return Response.json(
          { error: "Ethereum RPC provider returned an error" },
          { status: 502 }
        );
      }

      type RpcResult = { result?: string; error?: { message: string } };
      const rpcJson = (await rpcResponse.json()) as RpcResult;
      if (rpcJson.error || !rpcJson.result) {
        console.error("ETH RPC error:", rpcJson.error);
        return Response.json(
          { error: "Ethereum RPC provider returned an error" },
          { status: 502 }
        );
      }

      const weiBig = BigInt(rpcJson.result);
      const ethInt = weiBig / WEI_PER_ETH;
      const remainder = weiBig % WEI_PER_ETH;
      // padStart(18, "0") preserves leading zeros for sub-1-ETH remainders
      // e.g. 0.5 ETH remainder = 500000000000000000 (already 18 digits, no padding needed)
      //      0.001 ETH remainder = 1000000000000000 (16 digits, padded to 001000000000000000)
      const balanceEth = `${ethInt}.${remainder.toString().padStart(18, "0")}`;
      const balanceWei = weiBig.toString();

      try {
        await env.DB.prepare(
          "INSERT INTO EthBalanceLookups (address, balance_eth) VALUES (?, ?)"
        )
          .bind(address, balanceEth)
          .run();
      } catch (error) {
        console.error("Failed to persist ETH balance lookup:", error);
      }

      return Response.json({ address, balanceWei, balanceEth });
    }

    if (pathname === "/api/eth-balance/history") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, address, balance_eth, queried_at FROM EthBalanceLookups ORDER BY queried_at DESC LIMIT ?"
        )
          .bind(MAX_HISTORY_RECORDS)
          .all();

        return Response.json(
          { history: results },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch (error) {
        console.error("Failed to fetch ETH balance history:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    if (pathname === "/api/landmarks") {
      const since = searchParams.get("since") ?? "2024-01-01T00:00:00";
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ?"
        )
          .bind(since)
          .all();

        return Response.json(
          { landmarks: results },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      } catch (error) {
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    // GET /api/token-price?ids=ethereum,bitcoin — live prices via CoinGecko
    if (pathname === "/api/token-price") {
      const ids = searchParams.get("ids") ?? "ethereum,bitcoin";
      // Validate: only allow alphanumeric + comma + hyphen to prevent injection
      if (!/^[a-z0-9,-]+$/.test(ids)) {
        return Response.json({ error: "Invalid token ids" }, { status: 400 });
      }
      const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eth&include_24hr_change=true`;
      let cgResp: Response;
      try {
        cgResp = await fetch(cgUrl, {
          headers: { Accept: "application/json" },
          cf: { cacheTtl: 60, cacheEverything: true },
        });
      } catch (err) {
        console.error("CoinGecko fetch failed:", err);
        return Response.json(
          { error: "Failed to reach price provider" },
          { status: 502 }
        );
      }
      if (!cgResp.ok) {
        return Response.json(
          { error: "Price provider returned an error" },
          { status: 502 }
        );
      }
      const prices = await cgResp.json();
      return Response.json(prices, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },

  // #2 — Scheduled handler: reset usage_count for keys whose billing period has expired
  async scheduled(_event, env, _ctx): Promise<void> {
    const now = new Date()
      .toISOString()
      .replace("T", " ")
      .split(".")[0];
    const nextReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .split(".")[0];
    try {
      const result = await env.DB.prepare(
        "UPDATE ApiKeys SET usage_count = 0, reset_at = ? WHERE reset_at <= ? AND active = 1"
      )
        .bind(nextReset, now)
        .run();
      console.log(`Usage rollover: reset ${result.meta.changes} key(s).`);
    } catch (err) {
      console.error("Usage rollover failed:", err);
    }

    // Also prune stale rate-limit log entries older than the window
    try {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
        .toISOString()
        .replace("T", " ")
        .split(".")[0];
      await env.DB.prepare(
        "DELETE FROM RateLimitLog WHERE requested_at < ?"
      )
        .bind(windowStart)
        .run();
    } catch (err) {
      console.error("RateLimitLog cleanup failed:", err);
    }
  },
} satisfies ExportedHandler<Env>;
