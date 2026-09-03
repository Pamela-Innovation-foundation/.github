/**
 * Shared webhook processing logic used by both the standalone blockchain
 * webhook worker and the main index worker.
 */
export async function handleWebhookRequest(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
    )
      .bind(JSON.stringify(data), timestamp)
      .run();
  } catch (error) {
    console.error("Database insert failed:", error);
    return Response.json(
      { error: "Failed to store webhook data" },
      { status: 500 }
    );
  }

  return Response.json({ success: true, timestamp }, { status: 201 });
}
