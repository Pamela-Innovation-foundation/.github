const MAX_REWIND_SECONDS = 86400 * 365; // cap at 1 year

function buildClockHtml(rewindMs: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Digital Clock</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: #e2e8f0;
      font-family: "Segoe UI", system-ui, sans-serif;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      text-align: center;
    }
    h1 {
      margin: 0 0 0.75rem 0;
      color: #7dd3fc;
      font-size: 1.25rem;
    }
    #time {
      font-size: 2rem;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.04em;
    }
    #rewind-label {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🕐 Digital Clock</h1>
    <div id="time">--:--:--</div>
    <div id="rewind-label"></div>
  </div>
  <script>
    const REWIND_MS = ${rewindMs};
    function tick() {
      const now = new Date(Date.now() - REWIND_MS);
      document.getElementById("time").textContent = now.toLocaleTimeString(
        "en-US",
        { hour12: false }
      );
    }
    if (REWIND_MS > 0) {
      const secs = REWIND_MS / 1000;
      document.getElementById("rewind-label").textContent =
        "⏪ rewound " + secs + "s";
    }
    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, _env, _ctx): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === "/clock") {
      const rewindParam = searchParams.get("rewind");
      let rewindMs = 0;

      if (rewindParam !== null) {
        const rewindSecs = Number(rewindParam);
        if (
          Number.isNaN(rewindSecs) ||
          !Number.isInteger(rewindSecs) ||
          rewindSecs < 0
        ) {
          return Response.json(
            { error: "rewind must be a non-negative integer (seconds)" },
            { status: 400 }
          );
        }
        rewindMs = Math.min(rewindSecs, MAX_REWIND_SECONDS) * 1000;
      }

      return new Response(buildClockHtml(rewindMs), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
