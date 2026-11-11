import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          API_KEY: "test-api-key-12345",
          ETH_RPC_URL: "https://cloudflare-eth.com",
          BLOCKSCOUT_MULTICHAIN_BASE_URL: "https://api.blockscout.example",
          BLOCKSCOUT_EXPLORER_BASE_URL: "https://explorer.blockscout.example",
          BLOCKSCOUT_DEFAULT_CHAIN_ID: "1",
        },
      },
    }),
  ],
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcovonly"],
      reportsDirectory: "./coverage",
    },
  },
});
