declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

declare module "vitest" {
  interface ProvidedContext {
    successHeader: string;
    replayHeader: string;
    lowAmountHeader: string;
  }
}
