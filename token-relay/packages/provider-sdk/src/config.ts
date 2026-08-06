import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type {
  AdapterKind,
  ModelTarget,
  ProcessEnvironment,
  ProviderConfig,
  ResolvedProviderConfig
} from "./types.ts";

const DEFAULT_RELAY_URL = "ws://127.0.0.1:8787/provider/v1/connect";
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const DEFAULT_KILL_GRACE_MS = 2_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_RECONNECT_INITIAL_MS = 500;
const DEFAULT_RECONNECT_MAX_MS = 15_000;
const DEFAULT_MAX_WS_PAYLOAD_BYTES = 4 * 1024 * 1024;
const ENV_REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ADAPTERS = new Set<AdapterKind>(["codex", "claude", "aiden", "custom"]);

export async function loadProviderConfig(
  path = defaultProviderConfigPath(),
  env: ProcessEnvironment = process.env
): Promise<ResolvedProviderConfig> {
  const resolvedPath = expandHome(path);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(resolvedPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load provider config at ${resolvedPath}: ${message}`, {
      cause: error
    });
  }
  const interpolated = interpolateEnvironment(value, env);
  return resolveProviderConfig(interpolated as ProviderConfig, env);
}

export function resolveProviderConfig(
  value: ProviderConfig,
  env: ProcessEnvironment = process.env
): ResolvedProviderConfig {
  if (!isObject(value)) {
    throw new Error("Provider config must be a JSON object.");
  }
  if (!isObject(value.models) || Object.keys(value.models).length === 0) {
    throw new Error("Provider config must define at least one model.");
  }
  if (Object.keys(value.models).length > 256) {
    throw new Error("Provider config may advertise at most 256 models.");
  }

  const models: Record<string, ModelTarget> = {};
  for (const [model, target] of Object.entries(value.models)) {
    if (!model.trim()) {
      throw new Error("Provider model names must not be empty.");
    }
    if (model !== model.trim()) {
      throw new Error(`Provider model name ${JSON.stringify(model)} must not contain surrounding whitespace.`);
    }
    if (model.length > 256) {
      throw new Error(`Provider model name ${JSON.stringify(model)} exceeds 256 characters.`);
    }
    models[model] = validateTarget(model, target);
  }

  const providerToken = nonEmpty(value.providerToken)
    ?? nonEmpty(env.TOKEN_RELAY_PROVIDER_TOKEN);
  if (!providerToken) {
    throw new Error(
      "Provider token is required. Set providerToken or TOKEN_RELAY_PROVIDER_TOKEN."
    );
  }

  const relayUrl = normalizeRelayUrl(
    nonEmpty(value.relayUrl)
      ?? nonEmpty(env.TOKEN_RELAY_URL)
      ?? DEFAULT_RELAY_URL
  );
  const concurrency = positiveInteger(value.concurrency, 1, "concurrency");
  if (concurrency > 1_024) {
    throw new Error("concurrency must be at most 1024.");
  }
  const jobTimeoutMs = positiveInteger(
    value.jobTimeoutMs,
    DEFAULT_JOB_TIMEOUT_MS,
    "jobTimeoutMs"
  );
  const maxOutputBytes = positiveInteger(
    value.maxOutputBytes,
    DEFAULT_MAX_OUTPUT_BYTES,
    "maxOutputBytes"
  );
  const killGraceMs = positiveInteger(
    value.killGraceMs,
    DEFAULT_KILL_GRACE_MS,
    "killGraceMs"
  );
  const connectTimeoutMs = positiveInteger(
    value.connectTimeoutMs,
    DEFAULT_CONNECT_TIMEOUT_MS,
    "connectTimeoutMs"
  );
  const reconnectInitialMs = positiveInteger(
    value.reconnectInitialMs,
    DEFAULT_RECONNECT_INITIAL_MS,
    "reconnectInitialMs"
  );
  const reconnectMaxMs = positiveInteger(
    value.reconnectMaxMs,
    DEFAULT_RECONNECT_MAX_MS,
    "reconnectMaxMs"
  );
  if (reconnectMaxMs < reconnectInitialMs) {
    throw new Error("reconnectMaxMs must be greater than or equal to reconnectInitialMs.");
  }

  return {
    relayUrl,
    providerToken,
    concurrency,
    models,
    jobTimeoutMs,
    maxOutputBytes,
    killGraceMs,
    connectTimeoutMs,
    reconnectInitialMs,
    reconnectMaxMs,
    maxWebSocketPayloadBytes: positiveInteger(
      value.maxWebSocketPayloadBytes,
      DEFAULT_MAX_WS_PAYLOAD_BYTES,
      "maxWebSocketPayloadBytes"
    )
  };
}

export function defaultProviderConfigPath(
  env: ProcessEnvironment = process.env
): string {
  return env.TOKEN_RELAY_PROVIDER_CONFIG
    ? expandHome(env.TOKEN_RELAY_PROVIDER_CONFIG)
    : resolve("provider.config.json");
}

function validateTarget(model: string, value: unknown): ModelTarget {
  if (!isObject(value) || !ADAPTERS.has(value.adapter as AdapterKind)) {
    throw new Error(
      `Model ${JSON.stringify(model)} must use adapter codex, claude, aiden, or custom.`
    );
  }
  const target = value as unknown as ModelTarget;
  if (target.adapter === "custom" && !nonEmpty(target.command)) {
    throw new Error(`Custom model ${JSON.stringify(model)} requires command.`);
  }
  validateOptionalString(target.command, `${model}.command`);
  validateOptionalString(target.cliModel, `${model}.cliModel`);
  validateStringArray(target.extraArgs, `${model}.extraArgs`);
  if (target.adapter === "custom") {
    validateStringArray(target.args, `${model}.args`);
    if (
      target.outputFormat !== undefined
      && target.outputFormat !== "text"
      && target.outputFormat !== "json"
    ) {
      throw new Error(`${model}.outputFormat must be text or json.`);
    }
  }
  if (target.env !== undefined) {
    if (!isObject(target.env)) {
      throw new Error(`${model}.env must be an object.`);
    }
    for (const [key, value] of Object.entries(target.env)) {
      if (!ENV_NAME.test(key) || typeof value !== "string") {
        throw new Error(`${model}.env must contain valid string environment entries.`);
      }
    }
  }
  validateStringArray(target.inheritEnv, `${model}.inheritEnv`);
  for (const name of target.inheritEnv ?? []) {
    if (!ENV_NAME.test(name)) {
      throw new Error(`${model}.inheritEnv contains invalid environment name ${name}.`);
    }
  }
  optionalPositiveInteger(target.timeoutMs, `${model}.timeoutMs`);
  optionalPositiveInteger(target.maxOutputBytes, `${model}.maxOutputBytes`);
  return target;
}

function normalizeRelayUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid relayUrl: ${value}`);
  }
  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("relayUrl must use ws, wss, http, or https.");
  }
  if (url.pathname === "" || url.pathname === "/") {
    url.pathname = "/provider/v1/connect";
  }
  url.hash = "";
  return url.toString();
}

function interpolateEnvironment(
  value: unknown,
  env: ProcessEnvironment
): unknown {
  if (typeof value === "string") {
    return value.replace(ENV_REFERENCE, (_match, name: string) => {
      const replacement = env[name];
      if (replacement === undefined) {
        throw new Error(`Environment variable ${name} referenced by provider config is not set.`);
      }
      return replacement;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateEnvironment(item, env));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        interpolateEnvironment(item, env)
      ])
    );
  }
  return value;
}

function positiveInteger(
  value: unknown,
  fallback: number,
  name: string
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value as number;
}

function optionalPositiveInteger(value: unknown, name: string): void {
  if (
    value !== undefined
    && (!Number.isSafeInteger(value) || (value as number) <= 0)
  ) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function validateStringArray(value: unknown, name: string): void {
  if (
    value !== undefined
    && (
      !Array.isArray(value)
      || !value.every((item) => typeof item === "string")
    )
  ) {
    throw new Error(`${name} must be an array of strings.`);
  }
}

function validateOptionalString(value: unknown, name: string): void {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return isAbsolute(path) ? path : resolve(path);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
