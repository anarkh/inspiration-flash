import { resolve } from "node:path";

export interface RelayServerOptions {
  host?: string;
  port?: number;
  databasePath?: string;
  adminToken?: string;
  publicUrl?: string;
  userSessionTtlMs?: number;
  requestTimeoutMs?: number;
  providerOnlineMs?: number;
  leaseMs?: number;
  corsOrigin?: string;
  bodyLimitBytes?: number;
  defaultProviderTokenLimit?: number;
  defaultProviderMaxConcurrent?: number;
  initialUserPoints?: number;
}

export interface ResolvedRelayServerOptions {
  host: string;
  port: number;
  databasePath: string;
  adminToken: string;
  publicUrl: string | null;
  userSessionTtlMs: number;
  requestTimeoutMs: number;
  providerOnlineMs: number;
  leaseMs: number;
  corsOrigin: string | null;
  bodyLimitBytes: number;
  defaultProviderTokenLimit: number;
  defaultProviderMaxConcurrent: number;
  initialUserPoints: number;
}

const DEFAULT_BODY_LIMIT_BYTES = 1_048_576;
const DEFAULT_PROVIDER_TOKEN_LIMIT = 1_000_000;
const DEFAULT_INITIAL_USER_POINTS = 100_000;

export function resolveRelayServerOptions(
  options: RelayServerOptions = {},
  env: NodeJS.ProcessEnv = process.env
): ResolvedRelayServerOptions {
  const adminToken = options.adminToken ?? env.TOKEN_RELAY_ADMIN_TOKEN ?? "";
  if (adminToken.length < 24) {
    throw new Error("TOKEN_RELAY_ADMIN_TOKEN must contain at least 24 characters.");
  }

  const databaseValue = options.databasePath
    ?? env.TOKEN_RELAY_DATABASE
    ?? "./data/token-relay.db";
  const databasePath = databaseValue === ":memory:"
    ? databaseValue
    : resolve(databaseValue);
  const corsOrigin = validatedCorsOrigin(
    nonEmpty(options.corsOrigin ?? env.TOKEN_RELAY_CORS_ORIGIN)
  );
  const host = nonEmpty(options.host ?? env.TOKEN_RELAY_HOST) ?? "127.0.0.1";
  const publicUrl = validatedPublicUrl(
    nonEmpty(options.publicUrl ?? env.TOKEN_RELAY_PUBLIC_URL)
  );
  if (!isLoopbackHost(host) && !publicUrl) {
    throw new Error(
      "TOKEN_RELAY_PUBLIC_URL is required when TOKEN_RELAY_HOST is not a loopback host."
    );
  }
  if (publicUrl && !isSecureOrLoopbackUrl(publicUrl)) {
    throw new Error(
      "TOKEN_RELAY_PUBLIC_URL must use HTTPS (loopback HTTP is allowed only for local development)."
    );
  }

  return {
    host,
    port: portValue(options.port ?? env.TOKEN_RELAY_PORT, 8787),
    databasePath,
    adminToken,
    publicUrl,
    userSessionTtlMs: positiveInteger(
      options.userSessionTtlMs ?? env.TOKEN_RELAY_USER_SESSION_TTL_MS,
      30 * 24 * 60 * 60 * 1_000,
      "TOKEN_RELAY_USER_SESSION_TTL_MS"
    ),
    requestTimeoutMs: positiveInteger(
      options.requestTimeoutMs ?? env.TOKEN_RELAY_REQUEST_TIMEOUT_MS,
      300_000,
      "TOKEN_RELAY_REQUEST_TIMEOUT_MS"
    ),
    providerOnlineMs: positiveInteger(
      options.providerOnlineMs ?? env.TOKEN_RELAY_PROVIDER_ONLINE_MS,
      45_000,
      "TOKEN_RELAY_PROVIDER_ONLINE_MS"
    ),
    leaseMs: positiveInteger(
      options.leaseMs ?? env.TOKEN_RELAY_LEASE_MS,
      360_000,
      "TOKEN_RELAY_LEASE_MS"
    ),
    corsOrigin,
    bodyLimitBytes: positiveInteger(
      options.bodyLimitBytes,
      DEFAULT_BODY_LIMIT_BYTES,
      "bodyLimitBytes"
    ),
    defaultProviderTokenLimit: positiveInteger(
      options.defaultProviderTokenLimit,
      DEFAULT_PROVIDER_TOKEN_LIMIT,
      "defaultProviderTokenLimit"
    ),
    defaultProviderMaxConcurrent: positiveInteger(
      options.defaultProviderMaxConcurrent,
      1,
      "defaultProviderMaxConcurrent"
    ),
    initialUserPoints: nonNegativeInteger(
      options.initialUserPoints ?? env.TOKEN_RELAY_INITIAL_POINTS,
      DEFAULT_INITIAL_USER_POINTS,
      "TOKEN_RELAY_INITIAL_POINTS"
    )
  };
}

function validatedPublicUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
      || url.search
      || url.hash
      || (url.pathname !== "/" && url.pathname !== "")) {
      throw new Error("not an origin URL");
    }
    return url.origin;
  } catch {
    throw new Error(
      "TOKEN_RELAY_PUBLIC_URL must be an http:// or https:// origin without a path."
    );
  }
}

function isSecureOrLoopbackUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === "https:" || isLoopbackHost(url.hostname);
}

function isLoopbackHost(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "127.0.0.1"
    || normalized === "localhost"
    || normalized === "::1"
    || normalized === "[::1]";
}

function validatedCorsOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value === "*") {
    throw new Error("TOKEN_RELAY_CORS_ORIGIN must be an exact trusted origin, not '*'.");
  }
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:")
      || url.origin !== value.replace(/\/$/, "")) {
      throw new Error("not an exact origin");
    }
    return url.origin;
  } catch {
    throw new Error(
      "TOKEN_RELAY_CORS_ORIGIN must be an exact http:// or https:// origin."
    );
  }
}

function nonEmpty(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function portValue(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error("TOKEN_RELAY_PORT must be an integer between 0 and 65535.");
  }
  return parsed;
}

function positiveInteger(
  value: number | string | undefined,
  fallback: number,
  label: string
): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return parsed;
}

function nonNegativeInteger(
  value: number | string | undefined,
  fallback: number,
  label: string
): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return parsed;
}
