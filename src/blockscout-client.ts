// Typed client for a small subset of the Blockscout REST API.
//
// Two upstreams are supported:
//   - Per-explorer Stats API: `${BLOCKSCOUT_EXPLORER_BASE_URL}/api/v2/stats...`
//     (no authentication).
//   - Multichain API: `${BLOCKSCOUT_MULTICHAIN_BASE_URL}/${chainId}/api/v2/...`
//     (optional `Authorization: Bearer <token>` header if BLOCKSCOUT_API_TOKEN is set).
//
// All functions validate inputs to prevent SSRF / path injection, apply a
// short timeout, and return `{ status, body }` so callers control the response
// shape.

const UPSTREAM_TIMEOUT_MS = 5000;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CHAIN_ID_RE = /^[0-9]+$/;
// Allow only simple slug segments under /api/v2/stats to prevent path escapes.
const STATS_PATH_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;

export type BlockscoutResult = {
  status: number;
  body: unknown;
};

export class BlockscoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockscoutValidationError";
  }
}

export class BlockscoutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockscoutConfigError";
  }
}

type BlockscoutEnv = {
  BLOCKSCOUT_MULTICHAIN_BASE_URL: string;
  BLOCKSCOUT_EXPLORER_BASE_URL: string;
  BLOCKSCOUT_DEFAULT_CHAIN_ID: string;
  BLOCKSCOUT_API_TOKEN?: string;
};

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function assertBaseUrl(url: string | undefined, name: string): string {
  if (!url) {
    throw new BlockscoutConfigError(`${name} is not configured`);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BlockscoutConfigError(`${name} is not a valid URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new BlockscoutConfigError(`${name} must be http(s)`);
  }
  return stripTrailingSlash(url);
}

async function fetchJson(
  url: string,
  headers: Record<string, string>
): Promise<BlockscoutResult> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  // Try to parse as JSON; fall back to text so we don't throw on non-JSON errors.
  let body: unknown;
  const text = await response.text();
  if (text.length === 0) {
    body = null;
  } else {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: response.status, body };
}

/**
 * Fetch a Stats API endpoint on the configured explorer.
 *
 * @param subPath  Path segments after `/api/v2/stats`, e.g. `""`,
 *                 `"/charts/transactions"`, `"/charts/market"`. Only simple
 *                 slug segments (letters, digits, `_`, `-`) are allowed.
 * @param query    Optional query string (already URL-encoded), e.g. `"from=..."`.
 */
export async function getStats(
  env: BlockscoutEnv,
  subPath: string,
  query?: string
): Promise<BlockscoutResult> {
  const base = assertBaseUrl(
    env.BLOCKSCOUT_EXPLORER_BASE_URL,
    "BLOCKSCOUT_EXPLORER_BASE_URL"
  );
  const normalized = subPath.startsWith("/") ? subPath.slice(1) : subPath;
  if (normalized.length > 0) {
    for (const segment of normalized.split("/")) {
      if (!STATS_PATH_SEGMENT_RE.test(segment)) {
        throw new BlockscoutValidationError("Invalid stats path");
      }
    }
  }
  const suffix = normalized.length > 0 ? `/${normalized}` : "";
  const qs = query && query.length > 0 ? `?${query}` : "";
  const url = `${base}/api/v2/stats${suffix}${qs}`;
  return fetchJson(url, {});
}

/**
 * Fetch audit reports for a smart contract from the multichain Blockscout API.
 *
 * @param chainId  Numeric chain ID (digits only). Falsy values fall back to
 *                 `BLOCKSCOUT_DEFAULT_CHAIN_ID`.
 * @param address  0x-prefixed 40-hex-char contract address.
 */
export async function getContractAuditReports(
  env: BlockscoutEnv,
  chainId: string | undefined,
  address: string
): Promise<BlockscoutResult> {
  const base = assertBaseUrl(
    env.BLOCKSCOUT_MULTICHAIN_BASE_URL,
    "BLOCKSCOUT_MULTICHAIN_BASE_URL"
  );
  const effectiveChainId = chainId ?? env.BLOCKSCOUT_DEFAULT_CHAIN_ID;
  if (!effectiveChainId || !CHAIN_ID_RE.test(effectiveChainId)) {
    throw new BlockscoutValidationError("Invalid chain id");
  }
  if (!ADDRESS_RE.test(address)) {
    throw new BlockscoutValidationError("Invalid contract address");
  }
  const headers: Record<string, string> = {};
  if (env.BLOCKSCOUT_API_TOKEN) {
    headers.Authorization = `Bearer ${env.BLOCKSCOUT_API_TOKEN}`;
  }
  const url = `${base}/${effectiveChainId}/api/v2/smart-contracts/${address}/audit-reports`;
  return fetchJson(url, headers);
}
