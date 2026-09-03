/**
 * globalSetup – runs in Node.js main thread (not Cloudflare Workers).
 *
 * Generates fresh EIP-3009 payment headers for integration tests.
 * Values are passed to test files via Vitest's inject() API using the
 * TestProject.provide() method from the GlobalSetupContext.
 */

import type { GlobalSetupContext } from "vitest/node";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

// Deterministic test wallet (Hardhat account #0).
// Never use this private key with real funds.
const PRIVATE_KEY =
  "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const CHAIN_ID = 84532;
const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const AMOUNT = "10000";
const NETWORK = "eip155:84532";

function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = h.length % 2 === 0 ? h : "0" + h;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
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
function abiEncodeAddress(addr: string): Uint8Array {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  const bytes = hexToBytes(clean.toLowerCase().padStart(40, "0"));
  const out = new Uint8Array(32);
  out.set(bytes, 12);
  return out;
}
function abiEncodeUint256(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let n = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}
function abiEncodeBytes32(hex: string): Uint8Array {
  return hexToBytes(hex);
}

const privKeyBytes = hexToBytes(PRIVATE_KEY);
const pubKeyUncompressed = secp256k1.getPublicKey(privKeyBytes, false);
const walletAddress =
  "0x" + bytesToHex(keccak256(pubKeyUncompressed.slice(1)).slice(12));

const enc = new TextEncoder();
const domainTypeHash = keccak256(enc.encode(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
));
const authTypeHash = keccak256(enc.encode(
  "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
));
const domainSeparator = keccak256(concat(
  domainTypeHash,
  keccak256(enc.encode("USDC")),
  keccak256(enc.encode("2")),
  abiEncodeUint256(BigInt(CHAIN_ID)),
  abiEncodeAddress(ASSET)
));

function signEIP3009(
  to: string, value: string, validAfter: number,
  validBefore: number, nonce: string
): string {
  const structHash = keccak256(concat(
    authTypeHash,
    abiEncodeAddress(walletAddress),
    abiEncodeAddress(to),
    abiEncodeUint256(BigInt(value)),
    abiEncodeUint256(BigInt(validAfter)),
    abiEncodeUint256(BigInt(validBefore)),
    abiEncodeBytes32(nonce)
  ));
  const msgHash = keccak256(concat(
    new Uint8Array([0x19, 0x01]), domainSeparator, structHash
  ));
  const sig65 = secp256k1.sign(msgHash, privKeyBytes, {
    format: "recovered", prehash: false,
  });
  const recovery = sig65[0];
  const rHex = bytesToHex(sig65.slice(1, 33));
  const sHex = bytesToHex(sig65.slice(33, 65));
  const vHex = (27 + recovery).toString(16).padStart(2, "0");
  return "0x" + rHex + sHex + vHex;
}

function buildEIP3009Header(opts: {
  validAfter: number; validBefore: number;
  nonce: string; amount?: string; to?: string;
}): string {
  const signature = signEIP3009(
    opts.to ?? PAY_TO, opts.amount ?? AMOUNT,
    opts.validAfter, opts.validBefore, opts.nonce
  );
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: "exact", network: NETWORK,
      amount: opts.amount ?? AMOUNT, asset: ASSET, payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      extra: { assetTransferMethod: "eip3009", name: "USDC", version: "2" },
    },
    payload: {
      signature,
      authorization: {
        from: walletAddress, to: opts.to ?? PAY_TO,
        value: opts.amount ?? AMOUNT,
        validAfter: String(opts.validAfter),
        validBefore: String(opts.validBefore),
        nonce: opts.nonce,
      },
    },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + bytesToHex(bytes);
}

export default function setup(ctx: GlobalSetupContext) {
  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 5;
  const validBefore = validAfter + 60;

  ctx.provide("successHeader",
    buildEIP3009Header({ validAfter, validBefore, nonce: randomNonce() }));
  ctx.provide("replayHeader",
    buildEIP3009Header({ validAfter, validBefore, nonce: randomNonce() }));
  ctx.provide("lowAmountHeader",
    buildEIP3009Header({ validAfter, validBefore, nonce: randomNonce(), amount: "1" }));
}
