const WEI_PER_ETH = BigInt("1000000000000000000");
const MAX_HISTORY_RECORDS = 100;
// Default to Cloudflare's public Ethereum JSON-RPC gateway when ETH_RPC_URL is not set.
const DEFAULT_ETH_RPC_URL = "https://cloudflare-eth.com";

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    // API key authentication for protected endpoints
    if (pathname.startsWith("/api/")) {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
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

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
