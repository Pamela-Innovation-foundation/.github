const WEI_PER_ETH = BigInt("1000000000000000000");
const MAX_HISTORY_RECORDS = 100;
const DEFAULT_ETH_RPC_URL = "https://cloudflare-eth.com";
const DEFAULT_ERC1155_CONTRACT = "0xf639b4ebb77df1ed4b5014c244f60e72b8adb29b";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ERC1155_TRANSFER_SINGLE_TOPIC =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
const ERC1155_TRANSFER_BATCH_TOPIC =
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";
const LOG_BLOCK_CHUNK_SIZE = 2_000n;
const MAX_ERC1155_EXPORT_BLOCK_RANGE = 20_000n;

// Plan configuration: monthly request limit (-1 = unlimited) and price in wei
const PLANS: Record<string, { limit: number; priceWei: bigint }> = {
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

type EthRpcError = { message: string };

type EthRpcLogsResponse = {
  result?: EthLog[];
  error?: EthRpcError;
};

type EthLog = {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  data: string;
  topics: string[];
};

type Erc1155ExportEventType = "mint" | "transfer" | "burn";

type Erc1155ExportRow = {
  contract: string;
  transactionHash: string;
  blockNumber: string;
  logIndex: number;
  eventType: Erc1155ExportEventType;
  operator: string;
  from: string;
  to: string;
  tokenId: string;
  value: string;
};

function isValidEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isValidDecimalInteger(value: string): boolean {
  return /^(0|[1-9]\d*)$/.test(value);
}

function bigintToHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function parseDecimalBigInt(
  value: string,
  fieldName: string
): { value?: bigint; error?: string } {
  if (!isValidDecimalInteger(value)) {
    return { error: `Invalid ${fieldName}` };
  }

  return { value: BigInt(value) };
}

function topicToAddress(topic: string | undefined): string {
  if (!topic || topic.length !== 66) {
    return ZERO_ADDRESS;
  }

  return `0x${topic.slice(-40)}`.toLowerCase();
}

function decodeUint256Word(data: string, wordIndex: number): bigint {
  const normalized = data.startsWith("0x") ? data.slice(2) : data;
  const start = wordIndex * 64;
  const end = start + 64;
  return BigInt(`0x${normalized.slice(start, end) || "0"}`);
}

function decodeUint256Array(
  data: string,
  offsetBytes: bigint
): bigint[] | null {
  const normalized = data.startsWith("0x") ? data.slice(2) : data;
  const normalizedLength = BigInt(normalized.length);

  if (
    offsetBytes < 0 ||
    offsetBytes % 32n !== 0n ||
    offsetBytes > normalizedLength / 2n
  ) {
    return null;
  }

  const startIndex = offsetBytes * 2n;
  if (startIndex + 64n > normalizedLength) {
    return null;
  }

  const length = BigInt(
    `0x${normalized.slice(Number(startIndex), Number(startIndex + 64n)) || "0"}`
  );
  const valuesStart = startIndex + 64n;
  const availableHexChars = normalizedLength - valuesStart;
  const availableWords = availableHexChars / 64n;

  if (
    availableHexChars < 0 ||
    length > availableWords ||
    length > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return null;
  }

  const values: bigint[] = [];

  for (let index = 0; index < Number(length); index += 1) {
    const valueStart = Number(valuesStart) + index * 64;
    values.push(
      BigInt(`0x${normalized.slice(valueStart, valueStart + 64) || "0"}`)
    );
  }

  return values;
}

function classifyErc1155Event(
  from: string,
  to: string
): Erc1155ExportEventType {
  if (from === ZERO_ADDRESS) {
    return "mint";
  }
  if (to === ZERO_ADDRESS) {
    return "burn";
  }
  return "transfer";
}

function rowMatchesFilters(
  row: Erc1155ExportRow,
  tokenId: string,
  participantAddress: string | null,
  exportType: "mints" | "transfers" | "all"
): boolean {
  if (row.tokenId !== tokenId) {
    return false;
  }

  if (
    participantAddress &&
    row.operator !== participantAddress &&
    row.from !== participantAddress &&
    row.to !== participantAddress
  ) {
    return false;
  }

  if (exportType === "mints") {
    return row.eventType === "mint";
  }

  if (exportType === "transfers") {
    return row.eventType === "transfer";
  }

  return true;
}

function logToErc1155Rows(log: EthLog): Erc1155ExportRow[] {
  const operator = topicToAddress(log.topics[1]);
  const from = topicToAddress(log.topics[2]);
  const to = topicToAddress(log.topics[3]);
  const contract = log.address.toLowerCase();
  const blockNumber = BigInt(log.blockNumber).toString();
  const logIndex = Number(BigInt(log.logIndex));

  if (log.topics[0] === ERC1155_TRANSFER_SINGLE_TOPIC) {
    const tokenId = decodeUint256Word(log.data, 0).toString();
    const value = decodeUint256Word(log.data, 1).toString();

    return [
      {
        contract,
        transactionHash: log.transactionHash,
        blockNumber,
        logIndex,
        eventType: classifyErc1155Event(from, to),
        operator,
        from,
        to,
        tokenId,
        value,
      },
    ];
  }

  if (log.topics[0] === ERC1155_TRANSFER_BATCH_TOPIC) {
    const idsOffset = decodeUint256Word(log.data, 0);
    const valuesOffset = decodeUint256Word(log.data, 1);
    const ids = decodeUint256Array(log.data, idsOffset);
    const values = decodeUint256Array(log.data, valuesOffset);

    if (!ids || !values || ids.length !== values.length) {
      return [];
    }

    return ids.map((id, index) => ({
      contract,
      transactionHash: log.transactionHash,
      blockNumber,
      logIndex,
      eventType: classifyErc1155Event(from, to),
      operator,
      from,
      to,
      tokenId: id.toString(),
      value: (values[index] ?? 0n).toString(),
    }));
  }

  return [];
}

function rowsToCsv(rows: Erc1155ExportRow[]): string {
  const headers = [
    "contract",
    "transactionHash",
    "blockNumber",
    "logIndex",
    "eventType",
    "operator",
    "from",
    "to",
    "tokenId",
    "value",
  ];
  const body = rows.map((row) =>
    [
      row.contract,
      row.transactionHash,
      row.blockNumber,
      row.logIndex.toString(),
      row.eventType,
      row.operator,
      row.from,
      row.to,
      row.tokenId,
      row.value,
    ].join(",")
  );

  return [headers.join(","), ...body].join("\n");
}

async function fetchErc1155Logs(
  rpcUrl: string,
  contract: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<{ logs?: EthLog[]; error?: string }> {
  const allLogs: EthLog[] = [];

  for (
    let currentFrom = fromBlock;
    currentFrom <= toBlock;
    currentFrom += LOG_BLOCK_CHUNK_SIZE
  ) {
    const currentTo =
      currentFrom + LOG_BLOCK_CHUNK_SIZE - 1n > toBlock
        ? toBlock
        : currentFrom + LOG_BLOCK_CHUNK_SIZE - 1n;

    let rpcResponse: Response;
    try {
      rpcResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getLogs",
          params: [
            {
              address: contract,
              fromBlock: bigintToHex(currentFrom),
              toBlock: bigintToHex(currentTo),
              topics: [
                [ERC1155_TRANSFER_SINGLE_TOPIC, ERC1155_TRANSFER_BATCH_TOPIC],
              ],
            },
          ],
          id: 1,
        }),
      });
    } catch (error) {
      console.error("ERC-1155 export RPC fetch failed:", error);
      return { error: "Failed to reach Ethereum RPC provider" };
    }

    if (!rpcResponse.ok) {
      console.error(
        "ERC-1155 export RPC returned non-OK status:",
        rpcResponse.status
      );
      return { error: "Ethereum RPC provider returned an error" };
    }

    const rpcJson = (await rpcResponse.json()) as EthRpcLogsResponse;
    if (rpcJson.error || !rpcJson.result) {
      console.error("ERC-1155 export RPC error:", rpcJson.error);
      return { error: "Ethereum RPC provider returned an error" };
    }

    allLogs.push(...rpcJson.result);
  }

  return { logs: allLogs };
}

function getValidatedReceivingWallet(
  env: Env
): { wallet: string; error?: never } | { wallet?: never; error: Response } {
  if (!isValidEthereumAddress(env.RECEIVING_WALLET)) {
    console.error("Invalid RECEIVING_WALLET configuration");
    return {
      error: Response.json(
        { error: "Receiving wallet is misconfigured" },
        { status: 500 }
      ),
    };
  }

  return { wallet: env.RECEIVING_WALLET };
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    // POST /pay — returns payment instructions for the requested plan
    if (pathname === "/pay" && request.method === "POST") {
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
          { error: "Invalid plan. Valid options: pro, enterprise" },
          { status: 400 }
        );
      }
      if (!payer_address || !/^0x[0-9a-fA-F]{40}$/.test(payer_address)) {
        return Response.json(
          { error: "Invalid payer Ethereum address" },
          { status: 400 }
        );
      }
      const receivingWallet = getValidatedReceivingWallet(env);
      if (receivingWallet.error) {
        return receivingWallet.error;
      }
      const validatedReceivingWallet = receivingWallet.wallet;
      const planInfo = PLANS[plan];
      const remainder = planInfo.priceWei % WEI_PER_ETH;
      const amountEth = `${planInfo.priceWei / WEI_PER_ETH}.${remainder
        .toString()
        .padStart(18, "0")}`;
      return Response.json({
        receiving_address: validatedReceivingWallet,
        amount_wei: planInfo.priceWei.toString(),
        amount_eth: amountEth,
        plan,
        payer_address,
        instructions: `Send exactly ${amountEth} ETH from ${payer_address} to ${validatedReceivingWallet}, then POST /activate with your tx_hash, payer_address, and plan.`,
      });
    }

    // POST /activate — verifies an on-chain payment and provisions an API key
    if (pathname === "/activate" && request.method === "POST") {
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
      const receivingWallet = getValidatedReceivingWallet(env);
      if (receivingWallet.error) {
        return receivingWallet.error;
      }
      const validatedReceivingWallet = receivingWallet.wallet;

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
      if (txData.to?.toLowerCase() !== validatedReceivingWallet.toLowerCase()) {
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

    if (pathname === "/api/erc1155/export") {
      const contract = (
        searchParams.get("contract") ?? DEFAULT_ERC1155_CONTRACT
      ).toLowerCase();
      const participantAddress = searchParams.get("address")?.toLowerCase();
      const tokenId = searchParams.get("tokenId") ?? "1";
      const exportType = (searchParams.get("type") ?? "mints").toLowerCase() as
        | "mints"
        | "transfers"
        | "all";
      const format = (searchParams.get("format") ?? "json").toLowerCase();
      const fromBlockParam = searchParams.get("fromBlock");
      const toBlockParam = searchParams.get("toBlock");

      if (!isValidEthereumAddress(contract)) {
        return Response.json(
          { error: "Invalid ERC-1155 contract address" },
          { status: 400 }
        );
      }
      if (participantAddress && !isValidEthereumAddress(participantAddress)) {
        return Response.json(
          { error: "Invalid participant address" },
          { status: 400 }
        );
      }
      if (!isValidDecimalInteger(tokenId)) {
        return Response.json({ error: "Invalid tokenId" }, { status: 400 });
      }
      if (!fromBlockParam || !toBlockParam) {
        return Response.json(
          { error: "fromBlock and toBlock are required" },
          { status: 400 }
        );
      }
      if (
        exportType !== "mints" &&
        exportType !== "transfers" &&
        exportType !== "all"
      ) {
        return Response.json(
          {
            error: "Invalid export type. Valid options: mints, transfers, all",
          },
          { status: 400 }
        );
      }
      if (format !== "json" && format !== "csv") {
        return Response.json(
          { error: "Invalid format. Valid options: json, csv" },
          { status: 400 }
        );
      }

      const parsedFromBlock = parseDecimalBigInt(fromBlockParam, "fromBlock");
      if (parsedFromBlock.error || parsedFromBlock.value === undefined) {
        return Response.json({ error: parsedFromBlock.error }, { status: 400 });
      }
      const parsedToBlock = parseDecimalBigInt(toBlockParam, "toBlock");
      if (parsedToBlock.error || parsedToBlock.value === undefined) {
        return Response.json({ error: parsedToBlock.error }, { status: 400 });
      }
      if (parsedFromBlock.value > parsedToBlock.value) {
        return Response.json(
          { error: "fromBlock must be less than or equal to toBlock" },
          { status: 400 }
        );
      }
      if (
        parsedToBlock.value - parsedFromBlock.value >
        MAX_ERC1155_EXPORT_BLOCK_RANGE
      ) {
        return Response.json(
          {
            error: `Block range too large. Maximum span is ${MAX_ERC1155_EXPORT_BLOCK_RANGE.toString()} blocks`,
          },
          { status: 400 }
        );
      }

      const rpcUrl = env.ETH_RPC_URL ?? DEFAULT_ETH_RPC_URL;
      const rpcResult = await fetchErc1155Logs(
        rpcUrl,
        contract,
        parsedFromBlock.value,
        parsedToBlock.value
      );

      if (rpcResult.error || !rpcResult.logs) {
        return Response.json(
          { error: rpcResult.error ?? "Failed to export ERC-1155 events" },
          { status: 502 }
        );
      }

      const rows = rpcResult.logs
        .flatMap((log) => logToErc1155Rows(log))
        .filter((row) =>
          rowMatchesFilters(
            row,
            tokenId,
            participantAddress ?? null,
            exportType
          )
        )
        .sort((left, right) => {
          const blockDifference =
            BigInt(left.blockNumber) - BigInt(right.blockNumber);
          if (blockDifference !== 0n) {
            return blockDifference < 0n ? -1 : 1;
          }

          return left.logIndex - right.logIndex;
        });

      if (format === "csv") {
        return new Response(rowsToCsv(rows), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="erc1155-export.csv"',
          },
        });
      }

      return Response.json(
        {
          contract,
          address: participantAddress ?? null,
          tokenId,
          type: exportType,
          fromBlock: parsedFromBlock.value.toString(),
          toBlock: parsedToBlock.value.toString(),
          count: rows.length,
          results: rows,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
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
