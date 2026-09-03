const CLOCK_HTML = `<!DOCTYPE html>
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
  </style>
</head>
<body>
  <div class="card">
    <h1>🕐 Digital Clock</h1>
    <div id="time">--:--:--</div>
  </div>
  <script>
    function tick() {
      const now = new Date();
      document.getElementById("time").textContent = now.toLocaleTimeString(
        "en-US",
        { hour12: false }
      );
    }
    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;

export default {
  async fetch(request, _env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/clock") {
      return new Response(CLOCK_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
