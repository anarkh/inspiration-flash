import type { ProviderLogger } from "./types.ts";

function write(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  metadata?: Record<string, unknown>
): void {
  const suffix = metadata && Object.keys(metadata).length > 0
    ? ` ${JSON.stringify(metadata)}`
    : "";
  const line = `[token-relay-provider] ${message}${suffix}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    if (process.env.TOKEN_RELAY_DEBUG === "1") {
      console.debug(line);
    }
  } else {
    console.info(line);
  }
}

export const consoleProviderLogger: ProviderLogger = {
  debug: (message, metadata) => write("debug", message, metadata),
  info: (message, metadata) => write("info", message, metadata),
  warn: (message, metadata) => write("warn", message, metadata),
  error: (message, metadata) => write("error", message, metadata)
};

export const silentProviderLogger: ProviderLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};
