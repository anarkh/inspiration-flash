export type EndpointKind = "codex" | "claude" | "aiden";
export type HookEvent = "stop" | "post-tool-use";
export type ConfigScope = "project" | "global";
export type BridgeVerdict = "pass" | "fail" | "uncertain";
export type BridgeOutputMode = "review" | "chat";
export type UncertainBehavior = "continue" | "pass";
export type BridgeRunSource = "hook" | "direct";
export type BridgeRunStatus = "running" | "pass" | "fail" | "uncertain" | "timed_out" | "late_pass" | "late_fail" | "late_uncertain" | "skipped" | "error" | "interrupted";
export type ConsumerRunStatus = "pending" | "running" | "pass" | "fail" | "uncertain" | "error" | "interrupted";

export interface Agent {
  id: EndpointKind;
  kind: EndpointKind;
  label: string;
  command: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BridgeRoute {
  producer: EndpointKind;
  consumers: EndpointKind[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  port: number;
  uncertainBehavior: UncertainBehavior;
  agents: Agent[];
  routes: BridgeRoute[];
}

export interface RawHookEnvelope {
  producer: EndpointKind;
  event: HookEvent;
  raw: unknown;
}

export interface RawDirectEnvelope {
  consumer: EndpointKind;
  message: string;
  cwd: string;
  sessionId: string | null;
  producer: EndpointKind;
  turnId: string | null;
  mode: BridgeOutputMode;
  sender: BridgeMessageSender | null;
  mentions: BridgeMention[];
}

export interface NormalizedHookPayload {
  producer: EndpointKind;
  event: HookEvent;
  raw: unknown;
  cwd: string;
  sessionId: string | null;
  turnId: string | null;
  hookEventName: string | null;
  stopHookActive: boolean;
  lastAssistantMessage: string | null;
  toolName: string | null;
  toolInput: unknown;
  toolResponse: unknown;
  sender: BridgeMessageSender | null;
  mentions: BridgeMention[];
}

export interface BridgeMessageSender {
  type: string;
  openId?: string;
  name?: string;
}

export interface BridgeMention {
  openId?: string;
  name: string;
}

export interface GitContext {
  isGitRepo: boolean;
  status: string;
  changedFiles: string[];
  diff: string;
  stagedDiff: string;
  untrackedDiff: string;
}

export interface BridgeFinding {
  severity?: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail?: string;
  file?: string;
  line?: number;
}

export interface BridgeResult {
  verdict: BridgeVerdict;
  summary: string;
  findings: BridgeFinding[];
  suggestedPrompt: string;
  agent?: string;
  rawOutput?: string;
}

export interface BridgeResponse {
  shouldContinue: boolean;
  result: BridgeResult;
  duplicate?: boolean;
  timedOut?: boolean;
  skipped?: boolean;
}

export interface ConsumerRunRecord {
  kind: EndpointKind;
  label: string;
  command: string;
  status: ConsumerRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  pid?: number;
  commandLine?: string;
  logPath?: string;
  workerLogPath?: string;
  terminalId?: string;
  terminalBackend?: "capture" | "tmux";
  tmuxSession?: string;
  workerId?: string;
  workerKey?: string;
  workerContextDir?: string;
  verdict?: BridgeVerdict;
  summary?: string;
  error?: string;
  late?: boolean;
}

export interface BridgeRunRecord {
  id: string;
  hash: string;
  source?: BridgeRunSource;
  producer: EndpointKind;
  event: HookEvent;
  cwd: string;
  sessionId: string | null;
  turnId: string | null;
  directMessagePreview?: string;
  status: BridgeRunStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  consumers: ConsumerRunRecord[];
  summary?: string;
  error?: string;
}

export interface CliChoice<T extends string> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}
