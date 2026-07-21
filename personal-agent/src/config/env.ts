import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliEnvOptions {
  PERSONAL_AGENT_ENV_FILE?: string;
  PERSONAL_AGENT_SKIP_DOTENV?: string;
}

/** Loads CLI environment variables from dotenv unless tests or callers opt out. */
export function loadCliEnv(env: CliEnvOptions = process.env): void {
  if (env.PERSONAL_AGENT_SKIP_DOTENV === "1") {
    return;
  }
  loadEnvFile(env.PERSONAL_AGENT_ENV_FILE ?? defaultEnvPath());
}

/** Loads a dotenv file without overriding environment variables that already exist. */
export function loadEnvFile(path: string): void {
  // `.env` should provide local defaults, but explicit shell environment values
  // must win so one-off test keys or CI secrets are not accidentally replaced.
  config({ path, override: false, quiet: true });
}

/** Resolves the package-local .env path for both source and built output. */
function defaultEnvPath(): string {
  // Works from both src/config/env.ts and dist/config/env.js because both live
  // two directories below the personal-agent package root.
  return join(dirname(fileURLToPath(import.meta.url)), "../..", ".env");
}
