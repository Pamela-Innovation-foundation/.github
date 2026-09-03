// test/x402.spec.ts
//
// Tests for the x402 "exact" EVM payment scheme.
//
// Unit tests use pre-computed fixtures (wide validity windows, wide
// maxTimeoutSeconds) so they never expire.
//
// Integration tests (HTTP endpoint) receive fresh payment headers from
// test/global-setup.ts via inject() – this avoids importing ethers
// directly in the Workers test environment (bundling conflict with ws).

import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, inject } from "vitest";
import {
  createPaymentRequirements,
  parsePaymentHeader,
  verifyPayment,
  verifyEIP3009Payment,
  verifyPermit2Payment,
  X402_PERMIT2_PROXY,
  type PaymentPayload,
  type PaymentRequirements,
} from "../src/x402";

// ── Constants shared across tests ──────────────────────────────────────────

const TEST_WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const CHAIN_ID = 84532;
const NETWORK = `eip155:${CHAIN_ID}`;
const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const AMOUNT = "10000";

// Wide validity window: validAfter in the distant past, validBefore in the
// far future.  maxTimeoutSeconds is set to a large value to match.
const WIDE_TIMEOUT = 9999999999;

const EIP3009_NONCE =
  "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480";
const PERMIT2_NONCE =
  "0xa1b2c3d4e5f6000000000000000000000000000000000000000000000000cafe";

// Payment requirements that accept the wide-window unit-test fixtures.
const WIDE_REQUIREMENTS: PaymentRequirements = createPaymentRequirements({
  resource: "/api/premium",
  description: "Access to premium market data",
  mimeType: "application/json",
  amount: AMOUNT,
  payTo: PAY_TO,
  asset: ASSET,
  network: NETWORK,
  tokenName: "USDC",
  tokenVersion: "2",
  maxTimeoutSeconds: WIDE_TIMEOUT,
});

// ── Pre-computed unit-test fixtures ────────────────────────────────────────
//
// Generated with Hardhat account #0 (deterministic private key).
// Validity window spans 2001 → 2286 so signatures never expire.
// See test/global-setup.ts for the signing logic used at integration time.

/**
 * Valid EIP-3009 payment header (base64-encoded JSON) for unit tests.
 *
 * Signed by TEST_WALLET_ADDRESS over:
 *   transferWithAuthorization(from=TEST_WALLET_ADDRESS, to=PAY_TO,
 *     value=10000, validAfter=1000000000, validBefore=9999999999,
 *     nonce=EIP3009_NONCE)
 *   domain: { name="USDC", version="2", chainId=84532, verifyingContract=ASSET }
 */
const EIP3009_HEADER =
  "eyJ4NDAyVmVyc2lvbiI6MiwiYWNjZXB0ZWQiOnsic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwiYW1vdW50IjoiMTAwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHgyMDk2OTNCYzZhZmMwQzUzMjhiQTM2RmFGMDNDNTE0RUYzMTIyODdDIiwibWF4VGltZW91dFNlY29uZHMiOjk5OTk5OTk5OTksImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJlaXAzMDA5IiwibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fSwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweGRkMDc2MzgxYjJlZTExNzE5NzA2NzdmYzRhMDU4NzhmZjM4NGRmMGY1NzEyOGI5YTUwOGY4MTE1YmIwMjUzMGQxMzUwM2Q2NTBlZTcwNzg5NzViYjk5ZGM0OTdlMzFhNWExZWY5ZWFiODdiOGI3YmIyNjYxNjgwYWNjNThhOGM5MWMiLCJhdXRob3JpemF0aW9uIjp7ImZyb20iOiIweGYzOUZkNmU1MWFhZDg4RjZGNGNlNmFCODgyNzI3OWNmZkZiOTIyNjYiLCJ0byI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsInZhbHVlIjoiMTAwMDAiLCJ2YWxpZEFmdGVyIjoiMTAwMDAwMDAwMCIsInZhbGlkQmVmb3JlIjoiOTk5OTk5OTk5OSIsIm5vbmNlIjoiMHhmMzc0NjYxM2MyZDkyMGI1ZmRhYmMwODU2ZjJhZWIyZDRmODhlZTYwMzdiOGNjNWQwNGE3MWE0NDYyZjEzNDgwIn19fQ==";

/**
 * Valid Permit2 payment header (base64-encoded JSON) for unit tests.
 */
const PERMIT2_HEADER =
  "eyJ4NDAyVmVyc2lvbiI6MiwiYWNjZXB0ZWQiOnsic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwiYW1vdW50IjoiMTAwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHgyMDk2OTNCYzZhZmMwQzUzMjhiQTM2RmFGMDNDNTE0RUYzMTIyODdDIiwibWF4VGltZW91dFNlY29uZHMiOjk5OTk5OTk5OTksImV4dHJhIjp7ImFzc2V0VHJhbnNmZXJNZXRob2QiOiJwZXJtaXQyIiwibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fSwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDliNDMzNjJhY2JjMjhiMTc0ZWIyZDE5NDExNmM3NDE5OTg5OTQzZjg3Y2Y0ZTMyN2E5NWMwM2QwODM5MmVjMzUzODExNjdmZGNlNDY3MDg4YWYyMTViNDk1M2U3ZGY1MDkxZjQ0MTA5OTJjMjYzOTMxZjljMDQyMGY3ZTZkOWZmMWIiLCJwZXJtaXQyQXV0aG9yaXphdGlvbiI6eyJwZXJtaXR0ZWQiOnsidG9rZW4iOiIweDAzNkNiRDUzODQyYzU0MjY2MzRlNzkyOTU0MWVDMjMxOGYzZENGN2UiLCJhbW91bnQiOiIxMDAwMCJ9LCJmcm9tIjoiMHhmMzlGZDZlNTFhYWQ4OEY2RjRjZTZhQjg4MjcyNzljZmZGYjkyMjY2Iiwic3BlbmRlciI6IjB4NDAyMENEODU2Qzg4MkQ1ZmI5MDNEOTlDRTM1MzE2QTA4NUJiMDAwMSIsIm5vbmNlIjoiMHhhMWIyYzNkNGU1ZjYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBjYWZlIiwiZGVhZGxpbmUiOiI5OTk5OTk5OTk5Iiwid2l0bmVzcyI6eyJ0byI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsInZhbGlkQWZ0ZXIiOiIxMDAwMDAwMDAwIiwiZXh0cmEiOnt9fX19fQ==";

// ── D1 setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(`DROP TABLE IF EXISTS X402Payments`),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS X402Payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payer TEXT NOT NULL,
        asset TEXT NOT NULL,
        network TEXT NOT NULL,
        amount TEXT NOT NULL,
        pay_to TEXT NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        method TEXT NOT NULL DEFAULT 'eip3009',
        created_at TEXT NOT NULL
      )
    `),
  ]);
});

// ── createPaymentRequirements ──────────────────────────────────────────────

describe("createPaymentRequirements", () => {
  it("builds a well-formed PaymentRequirements object", () => {
    const req = createPaymentRequirements({
      resource: "/api/data",
      description: "Premium data",
      mimeType: "application/json",
      amount: "5000",
      payTo: PAY_TO,
      asset: ASSET,
      network: NETWORK,
      tokenName: "USDC",
      tokenVersion: "2",
    });

    expect(req.scheme).toBe("exact");
    expect(req.network).toBe(NETWORK);
    expect(req.maxAmountRequired).toBe("5000");
    expect(req.payTo).toBe(PAY_TO);
    expect(req.asset).toBe(ASSET);
    expect(req.maxTimeoutSeconds).toBe(60);
    expect(req.extra.name).toBe("USDC");
    expect(req.extra.version).toBe("2");
    expect(req.outputSchema).toBeNull();
  });

  it("respects a custom maxTimeoutSeconds", () => {
    const req = createPaymentRequirements({
      resource: "/r",
      description: "d",
      mimeType: "text/plain",
      amount: "1",
      payTo: PAY_TO,
      asset: ASSET,
      network: NETWORK,
      tokenName: "USDC",
      tokenVersion: "2",
      maxTimeoutSeconds: 120,
    });
    expect(req.maxTimeoutSeconds).toBe(120);
  });
});

// ── parsePaymentHeader ─────────────────────────────────────────────────────

describe("parsePaymentHeader", () => {
  it("parses a valid base64-encoded JSON payload", () => {
    const parsed = parsePaymentHeader(EIP3009_HEADER);
    expect(parsed).not.toBeNull();
    expect(parsed?.x402Version).toBe(2);
    expect(parsed?.accepted.scheme).toBe("exact");
    expect(parsed?.accepted.network).toBe(NETWORK);
  });

  it("returns null for an empty string", () => {
    expect(parsePaymentHeader("")).toBeNull();
  });

  it("returns null for non-base64 input", () => {
    expect(parsePaymentHeader("not-base64!!!")).toBeNull();
  });

  it("returns null for base64 that decodes to non-JSON", () => {
    expect(parsePaymentHeader(btoa("not json at all"))).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const incomplete = { x402Version: 2 };
    expect(parsePaymentHeader(btoa(JSON.stringify(incomplete)))).toBeNull();
  });
});

// ── EIP-3009 verification (unit tests) ────────────────────────────────────

describe("verifyEIP3009Payment", () => {
  it("verifies a valid EIP-3009 signature", () => {
    const payload = parsePaymentHeader(EIP3009_HEADER)!;
    const result = verifyEIP3009Payment(payload, WIDE_REQUIREMENTS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payer.toLowerCase()).toBe(TEST_WALLET_ADDRESS.toLowerCase());
      expect(result.nonce).toBe(EIP3009_NONCE);
    }
  });

  it("rejects when authorization.to does not match payTo", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    const p = payload.payload as { authorization: { to: string } };
    p.authorization.to = "0x0000000000000000000000000000000000000001";
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyEIP3009Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/destination mismatch/i);
    }
  });

  it("rejects when payment amount is below required", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    const p = payload.payload as { authorization: { value: string } };
    p.authorization.value = "1";
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyEIP3009Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/insufficient payment/i);
    }
  });

  it("rejects an expired authorization (validBefore in the past)", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    const p = payload.payload as {
      authorization: { validBefore: string };
    };
    p.authorization.validBefore = String(
      Math.floor(Date.now() / 1000) - 10
    );
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyEIP3009Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/expired/i);
    }
  });

  it("rejects an authorization that is not yet active (validAfter in the future)", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    const p = payload.payload as {
      authorization: { validAfter: string };
    };
    p.authorization.validAfter = String(
      Math.floor(Date.now() / 1000) + 3600
    );
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyEIP3009Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not yet valid/i);
    }
  });

  it("rejects when the validity window exceeds maxTimeoutSeconds", () => {
    const payload = parsePaymentHeader(EIP3009_HEADER)!;
    // WIDE_VALID_BEFORE - WIDE_VALID_AFTER is ~9B seconds >> 30
    const strictReq = createPaymentRequirements({
      resource: "/api/premium",
      description: "Access to premium market data",
      mimeType: "application/json",
      amount: AMOUNT,
      payTo: PAY_TO,
      asset: ASSET,
      network: NETWORK,
      tokenName: "USDC",
      tokenVersion: "2",
      maxTimeoutSeconds: 30,
    });
    const result = verifyEIP3009Payment(payload, strictReq);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/maxTimeoutSeconds/i);
    }
  });

  it("rejects an asset mismatch", () => {
    const payload = parsePaymentHeader(EIP3009_HEADER)!;
    const wrongAssetReq = createPaymentRequirements({
      resource: "/api/premium",
      description: "Access to premium market data",
      mimeType: "application/json",
      amount: AMOUNT,
      payTo: PAY_TO,
      asset: "0x0000000000000000000000000000000000000001",
      network: NETWORK,
      tokenName: "USDC",
      tokenVersion: "2",
      maxTimeoutSeconds: WIDE_TIMEOUT,
    });
    const result = verifyEIP3009Payment(payload, wrongAssetReq);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/asset mismatch/i);
    }
  });

  it("rejects a network mismatch", () => {
    const payload = parsePaymentHeader(EIP3009_HEADER)!;
    const wrongNetworkReq = createPaymentRequirements({
      resource: "/api/premium",
      description: "Access to premium market data",
      mimeType: "application/json",
      amount: AMOUNT,
      payTo: PAY_TO,
      asset: ASSET,
      network: "eip155:1",
      tokenName: "USDC",
      tokenVersion: "2",
      maxTimeoutSeconds: WIDE_TIMEOUT,
    });
    const result = verifyEIP3009Payment(payload, wrongNetworkReq);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/network mismatch/i);
    }
  });

  it("rejects a tampered signature (last byte flipped)", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    const p = payload.payload as { signature: string };
    const sig = p.signature;
    p.signature = sig.slice(0, -2) + (sig.endsWith("1c") ? "1b" : "1c");
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyEIP3009Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
  });
});

// ── Permit2 verification (unit tests) ─────────────────────────────────────

describe("verifyPermit2Payment", () => {
  it("verifies a valid Permit2 signature", () => {
    const payload = parsePaymentHeader(PERMIT2_HEADER)!;
    const result = verifyPermit2Payment(payload, WIDE_REQUIREMENTS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payer.toLowerCase()).toBe(TEST_WALLET_ADDRESS.toLowerCase());
      expect(result.nonce).toBe(PERMIT2_NONCE);
    }
  });

  it("rejects when witness.to does not match payTo", () => {
    const payload = parsePaymentHeader(PERMIT2_HEADER)!;
    const wrongPayTo = createPaymentRequirements({
      resource: "/api/premium",
      description: "Access to premium market data",
      mimeType: "application/json",
      amount: AMOUNT,
      payTo: "0x0000000000000000000000000000000000000001",
      asset: ASSET,
      network: NETWORK,
      tokenName: "USDC",
      tokenVersion: "2",
      maxTimeoutSeconds: WIDE_TIMEOUT,
    });
    const result = verifyPermit2Payment(payload, wrongPayTo);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/destination mismatch/i);
    }
  });

  it("rejects an invalid Permit2 spender", () => {
    const payload = JSON.parse(atob(PERMIT2_HEADER)) as PaymentPayload;
    const p = payload.payload as {
      permit2Authorization: { spender: string };
    };
    p.permit2Authorization.spender =
      "0x0000000000000000000000000000000000000002";
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyPermit2Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/invalid spender/i);
    }
  });

  it("rejects an expired deadline", () => {
    const payload = JSON.parse(atob(PERMIT2_HEADER)) as PaymentPayload;
    const p = payload.payload as {
      permit2Authorization: { deadline: string };
    };
    p.permit2Authorization.deadline = String(
      Math.floor(Date.now() / 1000) - 10
    );
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyPermit2Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/expired/i);
    }
  });

  it("rejects a tampered Permit2 signature", () => {
    const payload = JSON.parse(atob(PERMIT2_HEADER)) as PaymentPayload;
    const p = payload.payload as { signature: string };
    const sig = p.signature;
    p.signature = sig.slice(0, -2) + (sig.endsWith("1b") ? "1c" : "1b");
    const modified = btoa(JSON.stringify(payload));

    const parsed = parsePaymentHeader(modified)!;
    const result = verifyPermit2Payment(parsed, WIDE_REQUIREMENTS);
    expect(result.success).toBe(false);
  });
});

// ── verifyPayment (dispatch) ───────────────────────────────────────────────

describe("verifyPayment (dispatcher)", () => {
  it("dispatches to EIP-3009 when assetTransferMethod is 'eip3009'", () => {
    const payload = parsePaymentHeader(EIP3009_HEADER)!;
    expect(verifyPayment(payload, WIDE_REQUIREMENTS).success).toBe(true);
  });

  it("dispatches to EIP-3009 when assetTransferMethod is omitted", () => {
    const payload = JSON.parse(atob(EIP3009_HEADER)) as PaymentPayload;
    delete (payload.accepted.extra as { assetTransferMethod?: string })
      .assetTransferMethod;
    const modified = btoa(JSON.stringify(payload));
    const parsed = parsePaymentHeader(modified)!;
    expect(verifyPayment(parsed, WIDE_REQUIREMENTS).success).toBe(true);
  });

  it("dispatches to Permit2 when assetTransferMethod is 'permit2'", () => {
    const payload = parsePaymentHeader(PERMIT2_HEADER)!;
    expect(verifyPayment(payload, WIDE_REQUIREMENTS).success).toBe(true);
  });
});

// ── X402_PERMIT2_PROXY constant ────────────────────────────────────────────

describe("Protocol constants", () => {
  it("X402_PERMIT2_PROXY is the canonical address from the spec", () => {
    expect(X402_PERMIT2_PROXY.toLowerCase()).toBe(
      "0x4020cd856c882d5fb903d99ce35316a085bb0001"
    );
  });
});

// ── HTTP endpoint integration tests ───────────────────────────────────────

describe("GET /api/premium (integration)", () => {
  it("returns 402 with payment requirements when no X-PAYMENT header", async () => {
    const response = await SELF.fetch("https://example.com/api/premium");
    expect(response.status).toBe(402);

    const body = (await response.json()) as {
      error: string;
      requirements: PaymentRequirements;
    };
    expect(body.error).toMatch(/payment required/i);
    expect(body.requirements).toBeDefined();
    expect(body.requirements.scheme).toBe("exact");
    expect(body.requirements.network).toBe(NETWORK);
    expect(response.headers.get("X-PAYMENT-REQUIREMENTS")).not.toBeNull();
  });

  it("returns 400 when X-PAYMENT header is not valid base64 JSON", async () => {
    const response = await SELF.fetch("https://example.com/api/premium", {
      headers: { "X-PAYMENT": "!!! not base64 !!!" },
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/invalid x-payment/i);
  });

  it("X-PAYMENT-REQUIREMENTS header contains valid JSON requirements", async () => {
    const response = await SELF.fetch("https://example.com/api/premium");
    const header = response.headers.get("X-PAYMENT-REQUIREMENTS");
    expect(header).not.toBeNull();
    const reqs = JSON.parse(header!) as PaymentRequirements;
    expect(reqs.scheme).toBe("exact");
    expect(reqs.maxAmountRequired).toBe(AMOUNT);
    expect(reqs.payTo).toBe(PAY_TO);
    expect(reqs.asset).toBe(ASSET);
  });

  it("returns 200 with premium content after a valid EIP-3009 payment", async () => {
    const header = inject("successHeader") as string;
    const response = await SELF.fetch("https://example.com/api/premium", {
      headers: { "X-PAYMENT": header },
    });

    expect(response.status).toBe(200);

    const paymentResponse = response.headers.get("X-PAYMENT-RESPONSE");
    expect(paymentResponse).not.toBeNull();
    const pr = JSON.parse(paymentResponse!) as {
      success: boolean;
      payer: string;
    };
    expect(pr.success).toBe(true);
    expect(pr.payer.toLowerCase()).toBe(TEST_WALLET_ADDRESS.toLowerCase());

    const body = (await response.json()) as {
      message: string;
      data: unknown[];
    };
    expect(body.message).toMatch(/premium/i);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 402 when the same nonce is reused (replay protection)", async () => {
    const header = inject("replayHeader") as string;

    // First request: accepted
    const first = await SELF.fetch("https://example.com/api/premium", {
      headers: { "X-PAYMENT": header },
    });
    expect(first.status).toBe(200);

    // Second request with the same nonce: rejected
    const second = await SELF.fetch("https://example.com/api/premium", {
      headers: { "X-PAYMENT": header },
    });
    expect(second.status).toBe(402);
    const body = (await second.json()) as { error: string };
    expect(body.error).toMatch(/duplicate nonce/i);
  });

  it("returns 402 when payment amount is below required", async () => {
    const header = inject("lowAmountHeader") as string;
    const response = await SELF.fetch("https://example.com/api/premium", {
      headers: { "X-PAYMENT": header },
    });
    expect(response.status).toBe(402);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/payment verification failed/i);
  });
});
