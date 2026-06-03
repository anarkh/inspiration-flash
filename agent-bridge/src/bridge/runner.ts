import { loadConfig } from "../config/store.ts";
import { bridgeGateTimeoutMs, BYPASS_ENV } from "../core/constants.ts";
import type { Agent, AppConfig, BridgeRunSource, BridgeMessageSender, BridgeMention, EndpointKind, RawDirectEnvelope, RawHookEnvelope, BridgeResponse, BridgeResult, NormalizedHookPayload } from "../core/types.ts";
import { normalizeHookPayload, bridgeHash } from "../hooks/payload.ts";
import { getAgentAdapter, runAgent } from "../agents/registry.ts";
import { commandErrorResult } from "../agents/shared/errors.ts";
import { collectGitContext } from "../integrations/git-context.ts";
import { createTerminalSession, formatCommandLine } from "../terminal/logs.ts";
import { attachTmuxRunner } from "../terminal/tmux.ts";
import { claimBridge } from "./recent.ts";
import { buildBridgePrompt, buildDirectBridgePrompt, shouldIncludeGitContextForTurn } from "./prompt.ts";
import { bridgeWorkerSession } from "./worker-session.ts";
import { gitFingerprint, loadSessionGitBaseline, recordSessionGitBaseline } from "./session-git-baseline.ts";
import { recordBridgeRunCompleted, recordBridgeRunError, recordBridgeRunLateCompleted, recordBridgeRunStarted, recordBridgeRunTimedOut, recordConsumerCompleted, recordConsumerError, recordConsumerProcessStarted, recordConsumerStarted } from "./run-state.ts";

interface ConsumerTask {
  agent: Agent;
  promise: Promise<BridgeResult>;
}

interface GateOutcome {
  response: BridgeResponse;
  completedAll: boolean;
}

interface RunRecordOptions {
  source: BridgeRunSource;
  directMessagePreview?: string;
}

type AfterGateCallback = (response: BridgeResponse) => Promise<void>;

export async function runBridge(envelope: RawHookEnvelope): Promise<BridgeResponse> {
  const payload = normalizeHookPayload(envelope.producer, envelope.event, envelope.raw);
  if (process.env[BYPASS_ENV] === "1" || payload.stopHookActive) {
    return passResponse("Bridge skipped to avoid recursive hook execution.");
  }

  const hash = bridgeHash(payload);
  if ((await claimBridge(hash)).duplicate) {
    return {
      ...passResponse("Duplicate bridge skipped."),
      duplicate: true
    };
  }

  const config = await loadConfig();
  const agents = selectRouteAgents(config, payload.producer);
  if (agents.length === 0) {
    return passResponse(`No enabled consumer route configured for ${payload.producer}. Run \`agent-bridge setup\` to map this producer to consumer agents.`);
  }

  let baselineGit: Awaited<ReturnType<typeof collectGitContext>> | null = null;
  let shouldRecordBaseline = false;
  return runRecordedConsumers(payload, hash, agents, config, { source: "hook" }, async () => {
    const git = await collectGitContext(payload.cwd);
    baselineGit = git;
    const baseline = await loadSessionGitBaseline(payload).catch(() => null);
    const reviewableTurn = shouldIncludeGitContextForTurn(payload);
    shouldRecordBaseline = reviewableTurn;
    const unchangedSinceBaseline = Boolean(baseline && baseline.fingerprint === gitFingerprint(git));
    const includeGitContext = reviewableTurn && !unchangedSinceBaseline;
    return buildBridgePrompt(payload, git, {
      includeGitContext,
      gitContextReason: includeGitContext
        ? undefined
        : !reviewableTurn
          ? "Omitted because this producer turn does not look like completed code work or a technical plan. This avoids reviewing unrelated changes from another conversation in the same workspace."
          : "Omitted because this exact git fingerprint was already successfully reviewed for this producer session."
    });
  }, async (response) => {
    if (shouldRecordBaseline && baselineGit && !response.timedOut && response.result.verdict === "pass") {
      await recordSessionGitBaseline(payload, baselineGit).catch(() => undefined);
    }
  });
}

export async function runDirectBridge(envelope: RawDirectEnvelope): Promise<BridgeResponse> {
  const direct = normalizeDirectEnvelope(envelope);
  const config = await loadConfig();
  const agent = await resolveDirectAgent(config, direct.consumer);
  const hash = bridgeHash(direct.payload);
  return runRecordedConsumers(direct.payload, hash, [agent], config, {
    source: "direct",
    directMessagePreview: previewDirectMessage(direct.message)
  }, async () => buildDirectBridgePrompt(direct.payload, direct.consumer, direct.message));
}

async function runRecordedConsumers(
  payload: NormalizedHookPayload,
  hash: string,
  agents: Agent[],
  config: AppConfig,
  options: RunRecordOptions,
  promptFactory: () => Promise<string>,
  afterGate?: AfterGateCallback
): Promise<BridgeResponse> {
  const runId = await recordBridgeRunStarted(payload, hash, agents, options).catch(() => null);
  try {
    const prompt = await promptFactory();
    const tasks = agents.map((agent) => startConsumerTask(runId, agent, payload, prompt));
    const outcome = await waitForGate(tasks, config);
    const response = outcome.response;
    if (runId) {
      if (response.timedOut) {
        await recordBridgeRunTimedOut(runId, response).catch(() => undefined);
      } else {
        await recordBridgeRunCompleted(runId, response).catch(() => undefined);
      }
      if (!outcome.completedAll) {
        void recordLateCompletion(runId, tasks).catch(() => undefined);
      }
    }
    if (afterGate) {
      await afterGate(response).catch(() => undefined);
    }
    return response;
  } catch (error) {
    if (runId) {
      await recordBridgeRunError(runId, error).catch(() => undefined);
    }
    throw error;
  }
}

function startConsumerTask(runId: string | null, agent: Agent, payload: NormalizedHookPayload, prompt: string): ConsumerTask {
  return {
    agent,
    promise: (async () => {
      const onProcessStart = (info: { pid: number; command: string; args: string[] }) => {
        if (!runId) {
          return;
        }
        void recordConsumerProcessStarted(runId, agent, {
          pid: info.pid,
          commandLine: formatCommandLine(info.command, info.args)
        }).catch(() => undefined);
      };
      const worker = getAgentAdapter(agent.kind).terminalMode === "worker"
        ? bridgeWorkerSession(payload, agent)
        : null;
      const terminal = runId
        ? createTerminalSession(runId, agent, payload.cwd, onProcessStart, worker
          ? {
            workerId: worker.id,
            workerKey: worker.key
          }
          : undefined)
        : null;
      if (terminal && runId) {
        attachTmuxRunner(terminal, {
          runId,
          agent,
          cwd: payload.cwd,
          onStart: onProcessStart
        });
      }
      if (runId) {
        await recordConsumerStarted(runId, agent, terminal
          ? {
            logPath: terminal.logPath,
            workerLogPath: terminal.workerLogPath,
            terminalId: terminal.terminalId,
            terminalBackend: terminal.backend,
            tmuxSession: terminal.tmuxSession,
            workerId: terminal.workerId,
            workerKey: terminal.workerKey,
            workerContextDir: terminal.workerContextDir
          }
          : undefined).catch(() => undefined);
      }
      try {
        const result = await runAgent(agent, payload.cwd, prompt, {
          capture: terminal?.capture,
          runner: terminal?.runner,
          workerContextDir: terminal?.workerContextDir,
          producerSessionId: payload.sessionId,
          producerSender: payload.sender,
          producerMentions: payload.mentions
        });
        if (runId) {
          await recordConsumerCompleted(runId, agent, result).catch(() => undefined);
        }
        return result;
      } catch (error) {
        if (runId) {
          await recordConsumerError(runId, agent, error).catch(() => undefined);
        }
        return commandErrorResult(agent, error);
      }
    })()
  };
}

async function waitForGate(tasks: ConsumerTask[], config: AppConfig): Promise<GateOutcome> {
  const timeoutMs = bridgeGateTimeoutMs();
  const timeout = createTimeout(timeoutMs);
  const pending = new Set(tasks);
  const results: BridgeResult[] = [];

  try {
    while (pending.size > 0) {
      const next = await Promise.race([
        timeout.promise,
        ...[...pending].map((task) => task.promise.then((result) => ({
          type: "result" as const,
          task,
          result
        })))
      ]);

      if (next.type === "timeout") {
        return {
          response: timedOutResponse(timeoutMs),
          completedAll: false
        };
      }

      pending.delete(next.task);
      results.push(next.result);
      if (next.result.verdict === "fail") {
        return {
          response: responseFromResult(next.result, config),
          completedAll: pending.size === 0
        };
      }
    }

    return {
      response: responseFromResult(combineResults(results), config),
      completedAll: true
    };
  } finally {
    timeout.cancel();
  }
}

async function recordLateCompletion(runId: string, tasks: ConsumerTask[]): Promise<void> {
  const settled = await Promise.all(tasks.map((task) => task.promise));
  await recordBridgeRunLateCompleted(runId, combineResults(settled));
}

export function selectRouteAgents(config: AppConfig, producer: EndpointKind): Agent[] {
  const route = config.routes.find((item) => item.enabled && item.producer === producer);
  if (!route) {
    return [];
  }
  const consumers = new Set(route.consumers);
  return config.agents.filter((agent) => agent.enabled && consumers.has(agent.kind));
}

async function resolveDirectAgent(config: AppConfig, consumer: EndpointKind): Promise<Agent> {
  const configured = config.agents.find((agent) => agent.kind === consumer);
  if (configured) {
    return configured;
  }
  const adapter = getAgentAdapter(consumer);
  const detected = await adapter.detect();
  const now = new Date().toISOString();
  return {
    id: consumer,
    kind: consumer,
    label: detected.label,
    command: detected.command,
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeDirectEnvelope(envelope: RawDirectEnvelope): { consumer: EndpointKind; message: string; payload: NormalizedHookPayload } {
  const object: Record<string, unknown> = isRecord(envelope) ? envelope : {};
  const consumer = endpointValue(object.consumer);
  if (!consumer) {
    throw new Error("direct send consumer must be codex, claude, or aiden");
  }
  const message = typeof object.message === "string" ? object.message : "";
  if (!message.trim()) {
    throw new Error("direct send message must not be empty");
  }
  const producer = endpointValue(object.producer) ?? "codex";
  const cwd = stringValue(object.cwd) ?? process.cwd();
  const sessionId = stringValue(object.sessionId);
  const turnId = stringValue(object.turnId);
  const sender = senderValue(object.sender);
  const mentions = mentionsValue(object.mentions);
  return {
    consumer,
    message,
    payload: {
      producer,
      event: "stop",
      raw: envelope,
      cwd,
      sessionId,
      turnId,
      hookEventName: "DirectSend",
      stopHookActive: false,
      lastAssistantMessage: message,
      toolName: null,
      toolInput: null,
      toolResponse: null,
      sender,
      mentions
    }
  };
}

function endpointValue(value: unknown): EndpointKind | null {
  return value === "codex" || value === "claude" || value === "aiden" ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function senderValue(value: unknown): BridgeMessageSender | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = stringValue(value.type);
  const openId = stringValue(value.openId) ?? stringValue(value.open_id);
  const name = stringValue(value.name);
  if (!type && !openId && !name) {
    return null;
  }
  return {
    type: type ?? "user",
    ...(openId ? { openId } : {}),
    ...(name ? { name } : {})
  };
}

function mentionsValue(value: unknown): BridgeMention[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): BridgeMention[] => {
    if (!isRecord(item)) {
      return [];
    }
    const name = stringValue(item.name);
    if (!name) {
      return [];
    }
    const openId = stringValue(item.openId) ?? stringValue(item.open_id);
    return [{
      name,
      ...(openId ? { openId } : {})
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewDirectMessage(message: string): string {
  const text = message.replace(/\s+/g, " ").trim();
  return text.length <= 120 ? text : `${text.slice(0, 119)}...`;
}

function combineResults(results: BridgeResult[]): BridgeResult {
  if (results.length === 1) {
    return results[0];
  }
  const verdict = results.some((result) => result.verdict === "fail")
    ? "fail"
    : results.some((result) => result.verdict === "uncertain")
      ? "uncertain"
      : "pass";
  const summaries = results.map((result) => `${result.agent ?? "Agent"}: ${result.summary}`);
  const suggestedPrompt = results
    .map((result) => result.suggestedPrompt)
    .filter(Boolean)
    .join("\n\n");
  return {
    verdict,
    summary: summaries.join("\n"),
    findings: results.flatMap((result) => result.findings.map((finding) => ({
      ...finding,
      title: `${result.agent ?? "Agent"}: ${finding.title}`
    }))),
    suggestedPrompt,
    rawOutput: results.map((result) => result.rawOutput).filter(Boolean).join("\n\n")
  };
}

function responseFromResult(result: BridgeResult, config: AppConfig): BridgeResponse {
  return {
    shouldContinue: result.verdict === "fail" || (result.verdict === "uncertain" && config.uncertainBehavior === "continue"),
    result
  };
}

function timedOutResponse(timeoutMs: number): BridgeResponse {
  return {
    shouldContinue: false,
    timedOut: true,
    result: {
      verdict: "uncertain",
      summary: `Agent Bridge timed out after ${formatDuration(timeoutMs)}. Consumer agents are still running in the background; check \`agent-bridge status\` for late results.`,
      findings: [],
      suggestedPrompt: ""
    }
  };
}

function passResponse(summary: string): BridgeResponse {
  return {
    shouldContinue: false,
    result: {
      verdict: "pass",
      summary,
      findings: [],
      suggestedPrompt: ""
    }
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m${rest}s`;
}

function createTimeout(ms: number): { promise: Promise<{ type: "timeout" }>; cancel: () => void } {
  let timer: NodeJS.Timeout;
  const promise = new Promise<{ type: "timeout" }>((resolve) => {
    timer = setTimeout(() => resolve({ type: "timeout" }), ms);
    timer.unref?.();
  });
  return {
    promise,
    cancel: () => clearTimeout(timer)
  };
}
