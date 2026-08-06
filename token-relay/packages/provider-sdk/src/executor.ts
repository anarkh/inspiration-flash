import {
  estimateTextTokens,
  normalizeUsage,
  type ProviderFailure,
  type ProviderResult,
  type RelayJob
} from "@anarkhli/protocol";
import { basename } from "node:path";
import type {
  CustomModelTarget,
  ModelExecutor,
  ModelTarget,
  ProcessEnvironment,
  ProviderLogger
} from "./types.ts";
import { ProviderExecutionError } from "./types.ts";
import {
  CommandExecutionError,
  runFileInputCommand,
  type EphemeralCommandPaths
} from "./process.ts";
import { buildRelayPrompt } from "./prompt.ts";
import { silentProviderLogger } from "./logger.ts";

const SAFE_ENV_NAMES = [
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "LANG",
  "LC_ALL",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS"
] as const;

export interface CliModelExecutorOptions {
  defaultTimeoutMs?: number;
  defaultMaxOutputBytes?: number;
  killGraceMs?: number;
  logger?: ProviderLogger;
  sourceEnv?: ProcessEnvironment;
}

export class CliModelExecutor implements ModelExecutor {
  readonly #defaultTimeoutMs: number;
  readonly #defaultMaxOutputBytes: number;
  readonly #killGraceMs: number;
  readonly #logger: ProviderLogger;
  readonly #sourceEnv: ProcessEnvironment;

  constructor(options: CliModelExecutorOptions = {}) {
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 5 * 60 * 1000;
    this.#defaultMaxOutputBytes = options.defaultMaxOutputBytes ?? 2 * 1024 * 1024;
    this.#killGraceMs = options.killGraceMs ?? 2_000;
    this.#logger = options.logger ?? silentProviderLogger;
    this.#sourceEnv = options.sourceEnv ?? process.env;
  }

  async execute(
    job: RelayJob,
    target: ModelTarget,
    signal: AbortSignal
  ): Promise<ProviderResult> {
    const deadlineMs = Date.parse(job.deadlineAt) - Date.now();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) {
      throw new ProviderExecutionError(
        "DEADLINE_EXCEEDED",
        "The relay job deadline elapsed before local execution started.",
        { retryable: true }
      );
    }
    const timeoutMs = Math.max(
      1,
      Math.min(target.timeoutMs ?? this.#defaultTimeoutMs, deadlineMs)
    );
    const prompt = buildRelayPrompt(job);
    const command = target.command ?? defaultCommand(target.adapter);
    this.#logger.debug("Starting local model command.", {
      jobId: job.id,
      model: job.model,
      adapter: target.adapter,
      command: basename(command)
    });

    try {
      const result = await runFileInputCommand({
        command,
        buildArgs: (paths) => buildArguments(job, target, paths),
        input: prompt,
        env: minimalEnvironment(target, this.#sourceEnv),
        timeoutMs,
        maxOutputBytes: target.maxOutputBytes ?? this.#defaultMaxOutputBytes,
        killGraceMs: this.#killGraceMs,
        signal
      });
      const preferred = result.outputFile.trim() || result.stdout.trim();
      const content = extractAssistantText(
        preferred,
        target.adapter === "custom" ? target.outputFormat : undefined
      );
      if (!content.trim()) {
        throw new ProviderExecutionError(
          "EMPTY_OUTPUT",
          "The local model command returned no assistant output.",
          { retryable: true }
        );
      }
      return resultWithEstimatedUsage(job, content, prompt);
    } catch (error) {
      throw normalizeExecutionError(error);
    }
  }
}

export function toProviderFailure(error: unknown): ProviderFailure {
  if (error instanceof ProviderExecutionError) {
    return {
      code: error.code,
      message: truncateErrorMessage(error.message),
      retryable: error.retryable,
      ...(error.usage ? { usage: error.usage } : {})
    };
  }
  if (isAbortError(error)) {
    return {
      code: "CANCELLED",
      message: "The local model execution was cancelled.",
      retryable: false
    };
  }
  return {
    code: "EXECUTION_FAILED",
    message: "The local model executor failed unexpectedly.",
    retryable: true
  };
}

export function minimalEnvironment(
  target: ModelTarget,
  source: ProcessEnvironment = process.env
): ProcessEnvironment {
  const selected = new Set<string>([
    ...SAFE_ENV_NAMES,
    ...(target.inheritEnv ?? [])
  ]);
  const env: ProcessEnvironment = {};
  for (const name of selected) {
    const value = source[name];
    if (typeof value === "string") {
      env[name] = value;
    }
  }
  Object.assign(env, target.env ?? {});
  env.AGENT_BRIDGE_BYPASS = "1";
  env.TOKEN_RELAY_PROVIDER = "1";
  return env;
}

function buildArguments(
  job: RelayJob,
  target: ModelTarget,
  paths: EphemeralCommandPaths
): string[] {
  const cliModel = target.cliModel;
  const customModel = target.cliModel ?? job.model;
  switch (target.adapter) {
    case "codex":
      return [
        "exec",
        "-C",
        paths.workspaceDir,
        "-s",
        "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--disable",
        "hooks",
        "--output-last-message",
        paths.outputFile,
        ...(cliModel ? ["-m", cliModel] : []),
        ...(target.extraArgs ?? []),
        "-"
      ];
    case "claude":
      return [
        "-p",
        "--output-format",
        "json",
        "--permission-mode",
        "plan",
        "--max-turns",
        "3",
        ...(cliModel ? ["--model", cliModel] : []),
        ...(target.extraArgs ?? [])
      ];
    case "aiden":
      return [
        "--print",
        "--no-streaming",
        "--permission-mode",
        "readOnly",
        "--model-reasoning-effort",
        "low",
        "--workspace",
        paths.workspaceDir,
        "--add-dir",
        paths.rootDir,
        "--max-turns",
        "2",
        ...(cliModel ? ["--model", cliModel] : []),
        ...(target.extraArgs ?? []),
        `Read the Token Relay request from ${paths.promptFile} and return only the assistant answer in plain text.`
      ];
    case "custom":
      return [
        ...(target.args ?? []).map((argument) => replacePlaceholders(
          argument,
          customModel,
          paths
        )),
        ...(target.extraArgs ?? []).map((argument) => replacePlaceholders(
          argument,
          customModel,
          paths
        ))
      ];
  }
}

function replacePlaceholders(
  value: string,
  model: string,
  paths: EphemeralCommandPaths
): string {
  return value
    .replaceAll("{model}", model)
    .replaceAll("{workspace}", paths.workspaceDir)
    .replaceAll("{promptFile}", paths.promptFile)
    .replaceAll("{outputFile}", paths.outputFile);
}

function defaultCommand(adapter: ModelTarget["adapter"]): string {
  return adapter === "claude" ? "claude" : adapter;
}

function resultWithEstimatedUsage(
  job: RelayJob,
  rawContent: string,
  prompt: string
): ProviderResult {
  const truncated = truncateToEstimatedTokens(rawContent, job.maxOutputTokens);
  // Account for the actual wrapper passed to the CLI, not just the caller's
  // messages. If the CLI ignored the requested output limit, charge the full
  // generated output even though only the bounded prefix is returned.
  const promptTokens = estimateTextTokens(prompt);
  const completionTokens = estimateTextTokens(rawContent);
  return {
    content: truncated.content,
    finishReason: truncated.truncated ? "length" : "stop",
    usage: normalizeUsage(
      { promptTokens, completionTokens, estimated: true },
      promptTokens,
      completionTokens
    )
  };
}

function truncateToEstimatedTokens(
  text: string,
  maxTokens: number
): { content: string; truncated: boolean } {
  if (estimateTextTokens(text) <= maxTokens) {
    return { content: text, truncated: false };
  }
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimateTextTokens(characters.slice(0, middle).join("")) <= maxTokens) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return {
    content: characters.slice(0, low).join("").trimEnd(),
    truncated: true
  };
}

function extractAssistantText(
  raw: string,
  outputFormat?: CustomModelTarget["outputFormat"]
): string {
  const text = stripAnsi(raw).trim();
  if (outputFormat === "text") {
    return text;
  }
  const parsed = tryJson(text);
  if (parsed === null) {
    if (outputFormat === "json") {
      throw new ProviderExecutionError(
        "INVALID_OUTPUT",
        "The custom local model did not return valid JSON.",
        { retryable: false }
      );
    }
    return text;
  }
  return extractTextValue(parsed).trim();
}

function extractTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractTextValue).filter(Boolean).join("\n");
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ["result", "text", "content", "message", "output"]) {
      if (record[key] !== undefined) {
        const extracted = extractTextValue(record[key]);
        if (extracted) {
          return extracted;
        }
      }
    }
  }
  return "";
}

function normalizeExecutionError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) {
    return error;
  }
  if (!(error instanceof CommandExecutionError)) {
    return new ProviderExecutionError(
      "EXECUTION_FAILED",
      "The local model executor failed unexpectedly.",
      { retryable: true, cause: error }
    );
  }
  const combined = [error.stderr, error.stdout, error.message]
    .filter(Boolean)
    .join("\n");
  if (/429|rate.?limit|throughput limit|ProviderRetryPolicyExhausted/i.test(combined)) {
    return new ProviderExecutionError(
      "RATE_LIMITED",
      "The local model provider is rate limited.",
      { retryable: true, cause: error }
    );
  }
  if (/not\s+(?:logged|signed)\s+in|authentication|unauthorized|invalid api key|missing api key/i.test(combined)) {
    return new ProviderExecutionError(
      "AUTH_UNAVAILABLE",
      "The local model CLI is not authenticated.",
      { retryable: false, cause: error }
    );
  }
  const mapping: Record<CommandExecutionError["code"], {
    code: string;
    retryable: boolean;
  }> = {
    CANCELLED: { code: "CANCELLED", retryable: false },
    TIMEOUT: { code: "EXECUTION_TIMEOUT", retryable: true },
    OUTPUT_LIMIT: { code: "OUTPUT_LIMIT", retryable: false },
    SPAWN_FAILED: { code: "CLI_UNAVAILABLE", retryable: false },
    PROCESS_EXIT: { code: "CLI_FAILED", retryable: true }
  };
  const mapped = mapping[error.code];
  return new ProviderExecutionError(
    mapped.code,
    // stdout/stderr may echo the untrusted request. Keep them available on the
    // local CommandExecutionError for diagnostics, but never forward them as a
    // relay failure that the central service may persist.
    truncateErrorMessage(error.message),
    { retryable: mapped.retryable, cause: error }
  );
}

function tryJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "");
}

function truncateErrorMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length <= 2_000
    ? normalized
    : `${normalized.slice(0, 1_997)}...`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === "AbortError" || error.message === "AbortError");
}
