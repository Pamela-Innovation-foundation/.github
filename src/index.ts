<<<<<<< HEAD
const CLOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Digital Clock – Multiple Time Zones</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #e2e8f0;
      padding: 1rem;
    }
    h1 {
      font-size: clamp(1.25rem, 4vw, 2rem);
      margin-bottom: 2rem;
      letter-spacing: 0.05em;
      color: #7dd3fc;
    }
    .clocks {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      width: 100%;
      max-width: 1100px;
    }
    .clock-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.25rem 1rem;
      text-align: center;
      transition: transform 0.15s;
    }
    .clock-card:hover { transform: translateY(-3px); }
    .zone-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin-bottom: 0.35rem;
    }
    .zone-name {
      font-size: 1rem;
      font-weight: 600;
      color: #7dd3fc;
      margin-bottom: 0.75rem;
    }
    .time {
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 700;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
      color: #f1f5f9;
    }
    .date {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.4rem;
    }
  </style>
</head>
<body>
  <h1>🕐 Digital Clock</h1>
  <div class="clocks" id="clocks"></div>
  <script>
    const zones = [
      { label: "UTC",          tz: "UTC" },
      { label: "US Eastern",   tz: "America/New_York" },
      { label: "US Central",   tz: "America/Chicago" },
      { label: "US Mountain",  tz: "America/Denver" },
      { label: "US Pacific",   tz: "America/Los_Angeles" },
      { label: "London",       tz: "Europe/London" },
      { label: "Paris",        tz: "Europe/Paris" },
      { label: "Dubai",        tz: "Asia/Dubai" },
      { label: "Tokyo",        tz: "Asia/Tokyo" },
      { label: "Sydney",       tz: "Australia/Sydney" },
    ];

    const container = document.getElementById("clocks");

    zones.forEach(({ label, tz }) => {
      const card = document.createElement("div");
      card.className = "clock-card";
      card.innerHTML =
        '<div class="zone-label">' + tz + '</div>' +
        '<div class="zone-name">' + label + '</div>' +
        '<div class="time" id="time-' + tz.replace(/[/]/g, "-") + '"></div>' +
        '<div class="date" id="date-' + tz.replace(/[/]/g, "-") + '"></div>';
      container.appendChild(card);
    });

    function tick() {
      const now = new Date();
      zones.forEach(({ tz }) => {
        const id = tz.replace(/[/]/g, "-");
        const timeStr = now.toLocaleTimeString("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const dateStr = now.toLocaleDateString("en-US", {
          timeZone: tz,
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        document.getElementById("time-" + id).textContent = timeStr;
        document.getElementById("date-" + id).textContent = dateStr;
      });
    }

    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;

=======
>>>>>>> origin/copilot/d1-get-started
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

<<<<<<< HEAD
    if (pathname === "/api/beverages") {
=======
    if (pathname === "/api/landmarks") {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      const sinceParam = searchParams.get("since");
      const VALID_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;
      if (sinceParam !== null && !VALID_DATE_RE.test(sinceParam)) {
        return Response.json(
          { error: "Invalid 'since' parameter: expected YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS" },
          { status: 400 }
        );
      }
      const since = sinceParam ?? "2024-01-01T00:00:00";

>>>>>>> origin/copilot/d1-get-started
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ?"
        )
          .bind(since)
          .all();

        return Response.json(
          { landmarks: results },
          { headers: { "Cache-Control": "public, max-age=60" } }
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
