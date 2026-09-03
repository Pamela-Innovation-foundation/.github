import { execSync } from "node:child_process";

const hasTty = Boolean(process.stdout.isTTY);
const hasApiToken = Boolean(process.env.CLOUDFLARE_API_TOKEN);

if (!hasTty && !hasApiToken) {
  console.log(
    "Skipping D1 migration: set CLOUDFLARE_API_TOKEN in non-interactive envs."
  );
  process.exit(0);
}

execSync("wrangler d1 execute DB --file=schema.sql --remote", {
  stdio: "inherit",
});
