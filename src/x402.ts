/**
 * x402 Payment Protocol – "exact" scheme on EVM
 *
 * Implements the exact scheme supporting two asset transfer methods:
 *   1. EIP-3009  – tokens with native transferWithAuthorization (e.g. USDC)
 *   2. Permit2   – universal fallback via the canonical Permit2 contract +
 *                  x402ExactPermit2Proxy
 *
 * Cryptography uses @noble/curves (secp256k1) and @noble/hashes (keccak-256)
 * which have zero Node.js dependencies and work natively in Cloudflare Workers.
 *
 * Reference: https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

// ─── Protocol constants ────────────────────────────────────────────────────

export const X402_VERSION = 2;
export const X402_SCHEME = "exact" as const;

/** Canonical Permit2 contract address (same on all EVM chains). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Canonical x402ExactPermit2Proxy address.
 * Deployed via CREATE2 to the same address on all supported EVM chains.
 */
export const X402_PERMIT2_PROXY = "0x4020CD856C882D5fb903D99CE35316A085Bb0001";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema: null;
  extra: {
    name: string;
    version: string;
  };
}

export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface EIP3009Payload {
  signature: string;
  authorization: EIP3009Authorization;
}

export interface Permit2Authorization {
  permitted: {
    token: string;
    amount: string;
  };
  from: string;
  spender: string;
  nonce: string;
  deadline: string;
  witness: {
    to: string;
    validAfter: string;
    extra: Record<string, unknown>;
  };
}

export interface Permit2Payload {
  signature: string;
  permit2Authorization: Permit2Authorization;
}

export interface PaymentPayload {
  x402Version: number;
  resource?: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepted: {
    scheme: "exact";
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
      assetTransferMethod?: "eip3009" | "permit2";
      name: string;
      version: string;
    };
  };
  payload: EIP3009Payload | Permit2Payload;
}

export type VerificationResult =
  | { success: true; payer: string; nonce: string }
  | { success: false; error: string };

// ─── Crypto utilities ──────────────────────────────────────────────────────

/** Hash bytes with keccak-256. */
function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}

/** Hex string (with or without "0x") → Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = h.length % 2 === 0 ? h : "0" + h;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Uint8Array → lowercase hex string without "0x". */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Concatenate multiple Uint8Arrays. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ─── ABI-encoding primitives ───────────────────────────────────────────────
//
// These implement the strict subset of Solidity ABI encoding needed for
// EIP-712 struct hashing (all values are padded to 32 bytes; dynamic types
// are pre-hashed as required by the EIP-712 spec).

/** Encode an EVM address as a 32-byte ABI word (left-padded with zeroes). */
function abiEncodeAddress(address: string): Uint8Array {
  const clean = address.startsWith("0x") ? address.slice(2) : address;
  const addrBytes = hexToBytes(clean.toLowerCase().padStart(40, "0"));
  const out = new Uint8Array(32);
  out.set(addrBytes, 12);
  return out;
}

/** Encode a uint256 as a 32-byte big-endian ABI word. */
function abiEncodeUint256(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let n = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

/** Return a bytes32 value as a 32-byte array (hex string input). */
function abiEncodeBytes32(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 32) {
    throw new Error(
      `bytes32 must be 32 bytes, got ${bytes.length} from hex: ${hex}`
    );
  }
  return bytes;
}

// ─── EIP-712 helpers ───────────────────────────────────────────────────────

/**
 * Compute an EIP-712 domain separator.
 * domainFields must map field names to 32-byte ABI-encoded values.
 */
function eip712DomainSeparator(
  typeHash: Uint8Array,
  fields: Uint8Array[]
): Uint8Array {
  return keccak256(concat(typeHash, ...fields));
}

/**
 * Compute an EIP-712 struct hash.
 */
function eip712StructHash(
  typeHash: Uint8Array,
  fields: Uint8Array[]
): Uint8Array {
  return keccak256(concat(typeHash, ...fields));
}

/**
 * Compute the final EIP-712 message hash:
 *   keccak256("\x19\x01" || domainSeparator || structHash)
 */
function eip712HashTypedData(
  domainSeparator: Uint8Array,
  structHash: Uint8Array
): Uint8Array {
  return keccak256(
    concat(new Uint8Array([0x19, 0x01]), domainSeparator, structHash)
  );
}

// ─── secp256k1 address recovery ────────────────────────────────────────────

/**
 * Recover the EVM address that signed a 32-byte message hash.
 * The signature is the standard Ethereum hex string (r || s || v, 65 bytes).
 */
function recoverAddress(msgHash: Uint8Array, signatureHex: string): string {
  const sigHex = signatureHex.startsWith("0x")
    ? signatureHex.slice(2)
    : signatureHex;

  if (sigHex.length !== 130) {
    throw new Error(
      `Invalid signature length: expected 130 hex chars (65 bytes: r||s||v), got ${sigHex.length}`
    );
  }

  const compact = sigHex.slice(0, 128); // r (64) + s (64)
  const vHex = sigHex.slice(128, 130);
  const v = parseInt(vHex, 16);
  const recoveryBit = (v - 27) as 0 | 1;

  if (recoveryBit !== 0 && recoveryBit !== 1) {
    throw new Error(`Invalid v value: ${v}`);
  }

  const sig = secp256k1.Signature.fromHex(compact).addRecoveryBit(
    recoveryBit
  );
  const pubKey = sig.recoverPublicKey(msgHash);

  // Uncompressed public key: 04 || x (32B) || y (32B)
  const uncompressed = pubKey.toBytes(false);
  // EVM address = last 20 bytes of keccak256(x || y)
  const pubKeyBytes = uncompressed.slice(1);
  const addrHash = keccak256(pubKeyBytes);
  return "0x" + bytesToHex(addrHash.slice(12));
}

// ─── Pre-computed EIP-712 type hashes ─────────────────────────────────────

const DOMAIN_TYPE_EIP3009 =
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const TRANSFER_AUTH_TYPE =
  "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";

const PERMIT2_DOMAIN_TYPE =
  "EIP712Domain(uint256 chainId,address verifyingContract)";
const PERMIT_WITNESS_TYPE =
  "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)" +
  "Witness(bytes extra,address to,uint256 validAfter)" +
  "TokenPermissions(address token,uint256 amount)";
const WITNESS_TYPE = "Witness(bytes extra,address to,uint256 validAfter)";
const TOKEN_PERMISSIONS_TYPE = "TokenPermissions(address token,uint256 amount)";

const TRANSFER_AUTH_TYPEHASH = keccak256(
  new TextEncoder().encode(TRANSFER_AUTH_TYPE)
);
const PERMIT_WITNESS_TYPEHASH = keccak256(
  new TextEncoder().encode(PERMIT_WITNESS_TYPE)
);
const WITNESS_TYPEHASH = keccak256(new TextEncoder().encode(WITNESS_TYPE));
const TOKEN_PERMISSIONS_TYPEHASH = keccak256(
  new TextEncoder().encode(TOKEN_PERMISSIONS_TYPE)
);
const PERMIT2_DOMAIN_TYPEHASH = keccak256(
  new TextEncoder().encode(PERMIT2_DOMAIN_TYPE)
);

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse a CAIP-2 network string ("eip155:<chainId>") into a numeric chain ID. */
function parseChainId(network: string): number {
  const [prefix, id] = network.split(":");
  if (prefix !== "eip155" || !id) {
    throw new Error(`Invalid network format: ${network}`);
  }
  const chainId = parseInt(id, 10);
  if (isNaN(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId in network: ${network}`);
  }
  return chainId;
}

// ─── Payment requirements factory ─────────────────────────────────────────

export interface CreatePaymentRequirementsParams {
  resource: string;
  description: string;
  mimeType: string;
  amount: string;
  payTo: string;
  asset: string;
  network: string;
  tokenName: string;
  tokenVersion: string;
  maxTimeoutSeconds?: number;
}

/** Build a PaymentRequirements object to be sent in a 402 response. */
export function createPaymentRequirements(
  params: CreatePaymentRequirementsParams
): PaymentRequirements {
  return {
    scheme: X402_SCHEME,
    network: params.network,
    maxAmountRequired: params.amount,
    resource: params.resource,
    description: params.description,
    mimeType: params.mimeType,
    payTo: params.payTo,
    maxTimeoutSeconds: params.maxTimeoutSeconds ?? 60,
    asset: params.asset,
    outputSchema: null,
    extra: {
      name: params.tokenName,
      version: params.tokenVersion,
    },
  };
}

// ─── Payment header parsing ────────────────────────────────────────────────

/**
 * Decode and parse the base64-encoded JSON in the X-PAYMENT header.
 * Returns null if the header is missing, malformed, or structurally invalid.
 */
export function parsePaymentHeader(header: string): PaymentPayload | null {
  try {
    const decoded = atob(header);
    const parsed = JSON.parse(decoded) as PaymentPayload;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.x402Version === undefined ||
      !parsed.accepted ||
      !parsed.payload
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─── EIP-3009 verification ─────────────────────────────────────────────────

/**
 * Compute the EIP-3009 (transferWithAuthorization) domain separator.
 */
function computeEIP3009DomainSeparator(
  tokenName: string,
  tokenVersion: string,
  chainId: number,
  tokenAddress: string
): Uint8Array {
  const enc = new TextEncoder();
  const domainTypeHash = keccak256(enc.encode(DOMAIN_TYPE_EIP3009));
  return eip712DomainSeparator(domainTypeHash, [
    keccak256(enc.encode(tokenName)),
    keccak256(enc.encode(tokenVersion)),
    abiEncodeUint256(BigInt(chainId)),
    abiEncodeAddress(tokenAddress),
  ]);
}

/**
 * Verify an EIP-3009 (transferWithAuthorization) payment payload against the
 * supplied payment requirements.
 *
 * Checks (in order):
 *  1. Structural completeness
 *  2. Payment destination
 *  3. Amount coverage
 *  4. Validity window (validAfter / validBefore)
 *  5. Maximum timeout
 *  6. Asset and network match
 *  7. EIP-712 signature recovery
 */
export function verifyEIP3009Payment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): VerificationResult {
  const p = payload.payload as EIP3009Payload;

  if (!p.authorization || !p.signature) {
    return { success: false, error: "Missing authorization or signature" };
  }

  const auth = p.authorization;
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Destination
  if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return {
      success: false,
      error: `Payment destination mismatch: expected ${requirements.payTo}, got ${auth.to}`,
    };
  }

  // 2. Amount
  const paymentAmount = BigInt(auth.value);
  const requiredAmount = BigInt(requirements.maxAmountRequired);
  if (paymentAmount < requiredAmount) {
    return {
      success: false,
      error: `Insufficient payment: required ${requirements.maxAmountRequired}, got ${auth.value}`,
    };
  }

  // 3. Validity window
  const validAfter = parseInt(auth.validAfter, 10);
  const validBefore = parseInt(auth.validBefore, 10);
  if (nowSec < validAfter) {
    return { success: false, error: "Authorization is not yet valid" };
  }
  if (nowSec > validBefore) {
    return { success: false, error: "Authorization has expired" };
  }

  // 4. Maximum timeout
  if (validBefore - validAfter > requirements.maxTimeoutSeconds) {
    return {
      success: false,
      error: "Authorization validity window exceeds maxTimeoutSeconds",
    };
  }

  // 5. Asset / network
  if (
    payload.accepted.asset.toLowerCase() !== requirements.asset.toLowerCase()
  ) {
    return { success: false, error: "Asset mismatch" };
  }
  if (payload.accepted.network !== requirements.network) {
    return { success: false, error: "Network mismatch" };
  }

  // 6. EIP-712 signature recovery
  try {
    const chainId = parseChainId(requirements.network);

    const domainSeparator = computeEIP3009DomainSeparator(
      requirements.extra.name,
      requirements.extra.version,
      chainId,
      requirements.asset
    );

    const structHash = eip712StructHash(TRANSFER_AUTH_TYPEHASH, [
      abiEncodeAddress(auth.from),
      abiEncodeAddress(auth.to),
      abiEncodeUint256(BigInt(auth.value)),
      abiEncodeUint256(BigInt(auth.validAfter)),
      abiEncodeUint256(BigInt(auth.validBefore)),
      abiEncodeBytes32(auth.nonce),
    ]);

    const msgHash = eip712HashTypedData(domainSeparator, structHash);
    const recovered = recoverAddress(msgHash, p.signature);

    if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
      return {
        success: false,
        error: `Signature mismatch: recovered ${recovered}, expected ${auth.from}`,
      };
    }

    return { success: true, payer: auth.from, nonce: auth.nonce };
  } catch (err) {
    return {
      success: false,
      error: `Signature verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Permit2 verification ──────────────────────────────────────────────────

/**
 * Compute the Permit2 domain separator for a given chain.
 * Permit2 uses only (chainId, verifyingContract) – no name or version.
 */
function computePermit2DomainSeparator(chainId: number): Uint8Array {
  return eip712DomainSeparator(PERMIT2_DOMAIN_TYPEHASH, [
    abiEncodeUint256(BigInt(chainId)),
    abiEncodeAddress(PERMIT2_ADDRESS),
  ]);
}

/**
 * Verify a Permit2 (permitWitnessTransferFrom) payment payload against the
 * supplied payment requirements.
 *
 * Checks (in order):
 *  1. Structural completeness
 *  2. Payment destination (via witness.to)
 *  3. Amount coverage
 *  4. Deadline (not expired)
 *  5. validAfter (authorization is active)
 *  6. Maximum timeout
 *  7. Asset and network match
 *  8. Spender is the canonical x402ExactPermit2Proxy
 *  9. EIP-712 / Permit2 signature recovery
 */
export function verifyPermit2Payment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): VerificationResult {
  const p = payload.payload as Permit2Payload;

  if (!p.permit2Authorization || !p.signature) {
    return {
      success: false,
      error: "Missing permit2Authorization or signature",
    };
  }

  const auth = p.permit2Authorization;
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Destination (enforced via witness)
  if (auth.witness.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return {
      success: false,
      error: `Payment destination mismatch: expected ${requirements.payTo}, got ${auth.witness.to}`,
    };
  }

  // 2. Amount
  const paymentAmount = BigInt(auth.permitted.amount);
  const requiredAmount = BigInt(requirements.maxAmountRequired);
  if (paymentAmount < requiredAmount) {
    return {
      success: false,
      error: `Insufficient payment: required ${requirements.maxAmountRequired}, got ${auth.permitted.amount}`,
    };
  }

  // 3. Deadline (not expired)
  const deadline = parseInt(auth.deadline, 10);
  if (nowSec > deadline) {
    return { success: false, error: "Permit2 authorization deadline expired" };
  }

  // 4. validAfter (authorization is active)
  const validAfter = parseInt(auth.witness.validAfter, 10);
  if (nowSec < validAfter) {
    return { success: false, error: "Authorization is not yet valid" };
  }

  // 5. Maximum timeout
  if (deadline - validAfter > requirements.maxTimeoutSeconds) {
    return {
      success: false,
      error: "Authorization validity window exceeds maxTimeoutSeconds",
    };
  }

  // 6. Asset / network
  if (
    auth.permitted.token.toLowerCase() !== requirements.asset.toLowerCase()
  ) {
    return { success: false, error: "Asset mismatch" };
  }
  if (payload.accepted.network !== requirements.network) {
    return { success: false, error: "Network mismatch" };
  }

  // 7. Spender must be the canonical Permit2 proxy
  if (auth.spender.toLowerCase() !== X402_PERMIT2_PROXY.toLowerCase()) {
    return {
      success: false,
      error: `Invalid spender: expected ${X402_PERMIT2_PROXY}, got ${auth.spender}`,
    };
  }

  // 8. Permit2 EIP-712 signature recovery
  try {
    const chainId = parseChainId(requirements.network);

    // extra: encode empty object as empty bytes; keccak256 of empty bytes
    const extraBytes =
      Object.keys(auth.witness.extra).length === 0
        ? new Uint8Array(0)
        : new TextEncoder().encode(JSON.stringify(auth.witness.extra));
    const extraHash = keccak256(extraBytes);

    // witnessHash = keccak256(abi.encode(WITNESS_TYPEHASH, keccak256(extra), to, validAfter))
    const witnessHash = keccak256(
      concat(
        WITNESS_TYPEHASH,
        extraHash,
        abiEncodeAddress(auth.witness.to),
        abiEncodeUint256(BigInt(auth.witness.validAfter))
      )
    );

    // tokenPermissionsHash = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, token, amount))
    const tokenPermissionsHash = keccak256(
      concat(
        TOKEN_PERMISSIONS_TYPEHASH,
        abiEncodeAddress(auth.permitted.token),
        abiEncodeUint256(BigInt(auth.permitted.amount))
      )
    );

    // permitHash = keccak256(abi.encode(typeHash, tokenPermissions, spender, nonce, deadline, witnessHash))
    const permitHash = keccak256(
      concat(
        PERMIT_WITNESS_TYPEHASH,
        tokenPermissionsHash,
        abiEncodeAddress(auth.spender),
        abiEncodeUint256(BigInt(auth.nonce)),
        abiEncodeUint256(BigInt(auth.deadline)),
        witnessHash
      )
    );

    const domainSeparator = computePermit2DomainSeparator(chainId);
    const msgHash = eip712HashTypedData(domainSeparator, permitHash);
    const recovered = recoverAddress(msgHash, p.signature);

    if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
      return {
        success: false,
        error: `Signature mismatch: recovered ${recovered}, expected ${auth.from}`,
      };
    }

    return { success: true, payer: auth.from, nonce: auth.nonce };
  } catch (err) {
    return {
      success: false,
      error: `Signature verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Unified entry point ───────────────────────────────────────────────────

/**
 * Verify a payment payload against the supplied requirements.
 * Dispatches to the correct verifier based on `assetTransferMethod`
 * (defaulting to `eip3009` when omitted).
 */
export function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): VerificationResult {
  const method = payload.accepted.extra?.assetTransferMethod;
  if (method === "permit2") {
    return verifyPermit2Payment(payload, requirements);
  }
  return verifyEIP3009Payment(payload, requirements);
}

// ─── HTTP response helpers ─────────────────────────────────────────────────

/**
 * Build a 402 Payment Required response carrying the payment requirements in
 * the `X-PAYMENT-REQUIREMENTS` header (JSON-encoded).
 */
export function paymentRequired(requirements: PaymentRequirements): Response {
  return Response.json(
    {
      error: "Payment Required",
      x402Version: X402_VERSION,
      requirements,
    },
    {
      status: 402,
      headers: {
        "X-PAYMENT-REQUIREMENTS": JSON.stringify(requirements),
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Build a 200 response that signals a settled payment via the
 * `X-PAYMENT-RESPONSE` header.
 */
export function paymentAccepted(
  data: unknown,
  payer: string,
  headers?: Record<string, string>
): Response {
  return Response.json(data, {
    status: 200,
    headers: {
      "X-PAYMENT-RESPONSE": JSON.stringify({ success: true, payer }),
      ...headers,
    },
  });
}
