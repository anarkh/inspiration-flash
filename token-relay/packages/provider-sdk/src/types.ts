import type {
  ProviderFailure,
  ProviderResult,
  RelayJob
} from "@anarkhli/protocol";

export type BuiltinAdapterKind = "codex" | "claude" | "aiden";
export type AdapterKind = BuiltinAdapterKind | "custom";
export type CustomOutputFormat = "text" | "json";
export type ProcessEnvironment = Record<string, string | undefined>;

export interface BaseModelTarget {
  adapter: AdapterKind;
  command?: string;
  cliModel?: string;
  extraArgs?: string[];
  env?: Record<string, string>;
  inheritEnv?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface BuiltinModelTarget extends BaseModelTarget {
  adapter: BuiltinAdapterKind;
}

export interface CustomModelTarget extends BaseModelTarget {
  adapter: "custom";
  command: string;
  /**
   * Arguments are passed directly to spawn without a shell. Supported placeholders:
   * {model}, {workspace}, {promptFile}, and {outputFile}.
   */
  args?: string[];
  outputFormat?: CustomOutputFormat;
}

export type ModelTarget = BuiltinModelTarget | CustomModelTarget;

export interface ProviderConfig {
  relayUrl?: string;
  providerToken?: string;
  concurrency?: number;
  models: Record<string, ModelTarget>;
  jobTimeoutMs?: number;
  maxOutputBytes?: number;
  killGraceMs?: number;
  connectTimeoutMs?: number;
  reconnectInitialMs?: number;
  reconnectMaxMs?: number;
  maxWebSocketPayloadBytes?: number;
}

export interface ResolvedProviderConfig {
  relayUrl: string;
  providerToken: string;
  concurrency: number;
  models: Record<string, ModelTarget>;
  jobTimeoutMs: number;
  maxOutputBytes: number;
  killGraceMs: number;
  connectTimeoutMs: number;
  reconnectInitialMs: number;
  reconnectMaxMs: number;
  maxWebSocketPayloadBytes: number;
}

export interface ProviderLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface ModelExecutor {
  execute(
    job: RelayJob,
    target: ModelTarget,
    signal: AbortSignal
  ): Promise<ProviderResult>;
}

export interface ProviderClientOptions {
  executor?: ModelExecutor;
  logger?: ProviderLogger;
}

export type ProviderConnectionState =
  | "idle"
  | "connecting"
  | "ready"
  | "reconnecting"
  | "stopping"
  | "stopped";

export interface ProviderClientStatus {
  state: ProviderConnectionState;
  providerId: string | null;
  activeJobs: number;
  pendingResults: number;
  models: string[];
  concurrency: number;
}

export interface DoctorCheck {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
}

export class ProviderExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly usage?: ProviderFailure["usage"];

  constructor(
    code: string,
    message: string,
    options: {
      retryable?: boolean;
      usage?: ProviderFailure["usage"];
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderExecutionError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.usage = options.usage;
  }
}
