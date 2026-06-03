import type { Agent, BridgeMention, BridgeMessageSender, BridgeResult, EndpointKind } from "../core/types.ts";
import type { AgentCommandRunner, SpawnCapture, TerminalInputMode } from "./shared/process.ts";

export interface DetectedCli {
  kind: EndpointKind;
  label: string;
  command: string;
  found: boolean;
}

export interface AgentAdapter {
  kind: EndpointKind;
  label: string;
  defaultExecutable: string;
  terminalMode?: "command" | "worker";
  terminalInputMode?: TerminalInputMode;
  readyPattern?: RegExp;
  detect(): Promise<DetectedCli>;
  buildArgs?(options: AgentBuildArgsOptions): string[];
  buildResumeCommand?(options: AgentResumeCommandOptions): string | null;
  run(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult>;
}

export interface AgentBuildArgsOptions {
  sessionId: string;
  resume: boolean;
  workingDir?: string;
  contextDir?: string;
  disableCliBypass?: boolean;
}

export interface AgentResumeCommandOptions {
  sessionId: string;
  cliSessionId?: string;
}

export interface AgentRunContext {
  capture?: SpawnCapture;
  runner?: AgentCommandRunner;
  workerContextDir?: string;
  producerSessionId?: string | null;
  producerSender?: BridgeMessageSender | null;
  producerMentions?: BridgeMention[];
}
