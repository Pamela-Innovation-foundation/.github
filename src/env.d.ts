// Additional secrets not generated into worker-configuration.d.ts by wrangler types.
// Set with: wrangler secret put RECEIVING_WALLET
interface Env {
  RECEIVING_WALLET: string;
  BLOCKSCOUT_MULTICHAIN_BASE_URL: string;
  BLOCKSCOUT_EXPLORER_BASE_URL: string;
  BLOCKSCOUT_DEFAULT_CHAIN_ID: string;
  // Optional bearer token for api.blockscout.com. Set with:
  //   wrangler secret put BLOCKSCOUT_API_TOKEN
  BLOCKSCOUT_API_TOKEN?: string;
}
