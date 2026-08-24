import { BRIDGE_RUNS_FILE } from "../core/constants.ts";
import type { Agent, BridgeOutputMode, BridgeResponse, BridgeResult, BridgeRunRecord, BridgeRunSource, BridgeRunStatus, ConsumerRunRecord, NormalizedHookPayload } from "../core/types.ts";
import { readJson, writeJson } from "../utils/fs.ts";

const MAX_RUN_RECORDS = 50;
let updateQueue: Promise<unknown> = Promise.resolve();

export async function loadBridgeRuns(): Promise<BridgeRunRecord[]> {
  const runs = await readJson<BridgeRunRecord[]>(BRIDGE_RUNS_FILE, []);
  return Array.isArray(runs) ? runs : [];
}

export async function recordBridgeRunStarted(
  payload: NormalizedHookPayload,
  hash: string,
  agents: Agent[],
  options: { source?: BridgeRunSource; directMessagePreview?: string; outputMode?: BridgeOutputMode } = {}
): Promise<string> {
  const now = new Date().toISOString();
  const id = `${Date.now().toString(36)}-${hash.slice(0, 8)}`;
  const run: BridgeRunRecord = {
    id,
    hash,
    source: options.source ?? "hook",
    producer: payload.producer,
    event: payload.event,
    cwd: payload.cwd,
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    directMessagePreview: options.directMessagePreview,
    outputMode: options.outputMode,
    status: "running",
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    durationMs: null,
    consumers: agents.map((agent): ConsumerRunRecord => ({
      kind: agent.kind,
      label: agent.label,
      command: agent.command,
      status: "pending",
      startedAt: null,
      completedAt: null
    }))
  };
  await updateRuns((runs) => [run, ...runs]);
  return id;
}

export interface ConsumerTerminalInfo {
  logPath: string;
  workerLogPath?: string;
  terminalId: string;
  terminalBackend?: "capture" | "tmux";
  tmuxSession?: string;
  workerId?: string;
  workerKey?: string;
  workerContextDir?: string;
}

export interface ConsumerProcessInfo {
  pid: number;
  commandLine: string;
}

export async function recordConsumerStarted(runId: string, agent: Agent, terminal?: ConsumerTerminalInfo): Promise<void> {
  await updateRun(runId, (run, now) => {
    run.status = "running";
    const consumer = findConsumer(run, agent);
    consumer.status = "running";
    consumer.startedAt = consumer.startedAt ?? now;
    consumer.completedAt = null;
    if (terminal) {
      consumer.logPath = terminal.logPath;
      consumer.workerLogPath = terminal.workerLogPath;
      consumer.terminalId = terminal.terminalId;
      consumer.terminalBackend = terminal.terminalBackend;
      consumer.tmuxSession = terminal.tmuxSession;
      consumer.workerId = terminal.workerId;
      consumer.workerKey = terminal.workerKey;
      consumer.workerContextDir = terminal.workerContextDir;
    }
    delete consumer.error;
  });
}

export async function recordConsumerProcessStarted(runId: string, agent: Agent, processInfo: ConsumerProcessInfo): Promise<void> {
  await updateRun(runId, (run) => {
    const consumer = findConsumer(run, agent);
    consumer.pid = processInfo.pid;
    consumer.commandLine = processInfo.commandLine;
  });
}

export async function recordConsumerCompleted(runId: string, agent: Agent, result: BridgeResult): Promise<void> {
  await updateRun(runId, (run, now) => {
    const consumer = findConsumer(run, agent);
    consumer.late = run.completedAt !== null && consumer.completedAt === null;
    consumer.status = result.verdict;
    consumer.verdict = result.verdict;
    consumer.summary = result.summary;
    consumer.completedAt = now;
  });
}

export async function recordConsumerError(runId: string, agent: Agent, error: unknown): Promise<void> {
  await updateRun(runId, (run, now) => {
    const consumer = findConsumer(run, agent);
    consumer.late = run.completedAt !== null && consumer.completedAt === null;
    consumer.status = "error";
    consumer.error = error instanceof Error ? error.message : String(error);
    consumer.completedAt = now;
  });
}

export async function recordBridgeRunCompleted(runId: string, response: BridgeResponse): Promise<void> {
  await updateRun(runId, (run, now) => {
    run.status = response.result.verdict;
    run.summary = response.result.summary;
    run.completedAt = now;
    run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
  });
}

export async function recordBridgeRunTimedOut(runId: string, response: BridgeResponse): Promise<void> {
  await updateRun(runId, (run, now) => {
    run.status = "timed_out";
    run.summary = response.result.summary;
    run.completedAt = now;
    run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
  });
}

export async function recordBridgeRunLateCompleted(runId: string, result: BridgeResult): Promise<void> {
  await updateRun(runId, (run, now) => {
    if (run.status !== "timed_out") {
      return;
    }
    run.status = lateStatus(result.verdict);
    run.summary = result.summary;
    run.completedAt = now;
    run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
  });
}

export async function recordBridgeRunError(runId: string, error: unknown): Promise<void> {
  await updateRun(runId, (run, now) => {
    run.status = "error";
    run.error = error instanceof Error ? error.message : String(error);
    run.completedAt = now;
    run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
  });
}

export async function markInterruptedBridgeRuns(reason = "Agent Bridge service restarted before this run completed."): Promise<void> {
  await updateRuns((runs) => {
    const now = new Date().toISOString();
    for (const run of runs) {
      const interruptedConsumers = run.consumers.filter((consumer) => consumer.status === "pending" || consumer.status === "running");
      if (run.status !== "running" && interruptedConsumers.length === 0) {
        continue;
      }

      if (run.status === "running") {
        run.status = "interrupted";
        run.summary = reason;
        run.completedAt = now;
        run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
      }

      for (const consumer of interruptedConsumers) {
        consumer.status = "interrupted";
        consumer.error = reason;
        consumer.completedAt = now;
      }
      run.updatedAt = now;
    }
    return runs;
  });
}

function lateStatus(verdict: BridgeResult["verdict"]): BridgeRunStatus {
  return verdict === "fail"
    ? "late_fail"
    : verdict === "uncertain"
      ? "late_uncertain"
      : "late_pass";
}

async function updateRun(
  runId: string,
  mutate: (run: BridgeRunRecord, now: string) => void
): Promise<void> {
  await updateRuns((runs) => {
    const now = new Date().toISOString();
    const run = runs.find((item) => item.id === runId);
    if (!run) {
      return runs;
    }
    mutate(run, now);
    run.updatedAt = now;
    return runs;
  });
}

async function updateRuns(mutator: (runs: BridgeRunRecord[]) => BridgeRunRecord[]): Promise<void> {
  await enqueue(async () => {
    const runs = await loadBridgeRuns();
    const next = mutator(runs)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, MAX_RUN_RECORDS);
    await writeJson(BRIDGE_RUNS_FILE, next);
  });
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = updateQueue.then(work, work);
  updateQueue = next.then(() => undefined, () => undefined);
  return next;
}

function findConsumer(run: BridgeRunRecord, agent: Agent): ConsumerRunRecord {
  let consumer = run.consumers.find((item) => item.kind === agent.kind);
  if (!consumer) {
    consumer = {
      kind: agent.kind,
      label: agent.label,
      command: agent.command,
      status: "pending",
      startedAt: null,
      completedAt: null
    };
    run.consumers.push(consumer);
  }
  return consumer;
}
