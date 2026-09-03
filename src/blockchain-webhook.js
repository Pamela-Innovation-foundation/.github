/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests.
 *
 * The handler verifies an HMAC SHA-256 signature, reserves each webhook ID
 * exactly once in D1, then uses waitUntil() for asynchronous post-response
 * processing.
 */

const WEBHOOK_PATH = "/webhook";
const encoder = new TextEncoder();

function getSignature(headers) {
  return (
    headers.get("Webhook-Signature") ?? headers.get("X-Webhook-Signature")
  );
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function toBase64(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    ""
  );
  return btoa(binary);
}

function timingSafeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

async function createSignatureCandidates(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const signatureBytes = new Uint8Array(signatureBuffer);
  const hex = toHex(signatureBytes);
  const base64 = toBase64(signatureBytes);

  return [hex, `sha256=${hex}`, base64, `sha256=${base64}`];
}

async function isValidSignature(secret, payload, providedSignature) {
  const candidates = await createSignatureCandidates(secret, payload);
  return candidates.some((candidate) =>
    timingSafeEqual(candidate, providedSignature.trim())
  );
}

function isUniqueConstraintError(error) {
  return String(error).includes("UNIQUE constraint failed");
}

async function reserveWebhook(env, webhookId, rawPayload) {
  try {
    await env.DB.prepare(
      "INSERT INTO BlockchainWebhooks (webhook_id, data, timestamp, status) VALUES (?, ?, datetime('now'), 'received')"
    )
      .bind(webhookId, rawPayload)
      .run();
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }

    console.error("Failed to persist webhook:", error);
    throw error;
  }
}

async function updateWebhookStatus(env, webhookId, status) {
  await env.DB.prepare(
    "UPDATE BlockchainWebhooks SET status = ?, processed_at = datetime('now') WHERE webhook_id = ?"
  )
    .bind(status, webhookId)
    .run();
}

async function processWebhookAsync(env, webhookId, _eventData) {
  try {
    await updateWebhookStatus(env, webhookId, "processed");
  } catch (error) {
    console.error("Webhook processing failed:", error);

    try {
      await updateWebhookStatus(env, webhookId, "failed");
    } catch (updateError) {
      console.error("Failed to mark webhook as failed:", updateError);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname !== WEBHOOK_PATH) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!env.DB || !env.WEBHOOK_SECRET) {
      return Response.json(
        { error: "Webhook handler is not configured" },
        { status: 500 }
      );
    }

    const webhookId = request.headers.get("Webhook-ID");
    if (!webhookId) {
      return Response.json(
        { error: "Missing Webhook-ID header" },
        { status: 400 }
      );
    }

    const rawPayload = await request.text();
    const signature = getSignature(request.headers);
    if (
      !signature ||
      !(await isValidSignature(env.WEBHOOK_SECRET, rawPayload, signature))
    ) {
      return new Response("Invalid signature", { status: 400 });
    }

    let eventData;
    try {
      eventData = JSON.parse(rawPayload);
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let reserved;
    try {
      reserved = await reserveWebhook(env, webhookId, rawPayload);
    } catch {
      return Response.json(
        { error: "Failed to persist webhook" },
        { status: 500 }
      );
    }

    if (!reserved) {
      return new Response(null, { status: 200 });
    }

    ctx.waitUntil(processWebhookAsync(env, webhookId, eventData));
    return new Response(null, { status: 200 });
  },
};
