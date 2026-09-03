// Generate a random per-instance HMAC key for timing-safe comparisons.
// The key is ephemeral (not persisted) and used only to produce fixed-length
// digests for constant-time comparison. Key generation failures are fatal
// by design: a failed key means all comparisons would reject, which is the
// safe failure mode.
const _compareKey = crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"]
) as Promise<CryptoKey>;

// Performs a constant-time string comparison using HMAC to prevent timing attacks.
// Both inputs are signed with the same key producing two 32-byte HMAC-SHA256
// digests, which are then compared byte-by-byte with XOR accumulation.
async function timingSafeEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await _compareKey;
  const [hmacA, hmacB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hmacA);
  const viewB = new Uint8Array(hmacB);
  // Both outputs are HMAC-SHA256 (always 32 bytes); iterate the full length
  // so comparison time is constant and independent of input values.
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    // Normalize to lowercase so /API/ and /api/ are treated the same
    const normalizedPath = pathname.toLowerCase();

    // API key authentication for protected endpoints
    if (normalizedPath.startsWith("/api/")) {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || !(await timingSafeEquals(apiKey, env.API_KEY))) {
        return Response.json(
          { error: "Unauthorized - Invalid or missing API key" },
          {
            status: 401,
            headers: { "WWW-Authenticate": "ApiKey" },
          }
        );
      }
    }

    if (normalizedPath === "/api/beverages") {
      try {
        // Optimized: Select only needed columns instead of SELECT *
        // This reduces data transfer and improves query performance
        const { results } = await env.DB.prepare(
          "SELECT CustomerId, CompanyName, ContactName FROM Customers WHERE CompanyName = ?"
        )
          .bind("Bs Beverages")
          .all();

        // Add cache headers for better performance
        return Response.json(results, {
          headers: {
            "Cache-Control": "public, max-age=60",
          },
        });
      } catch (error) {
        // Proper error handling for database failures
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Failed to fetch beverages data" },
          { status: 500 }
        );
      }
    }

    return new Response(
      "Call /api/beverages to see everyone who works at Bs Beverages"
    );
  },
} satisfies ExportedHandler<Env>;
