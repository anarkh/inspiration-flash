import { BRIDGE_RUNS_FILE } from "../core/constants.js";
import { readJson, writeJson } from "../utils/fs.js";
const MAX_RUN_RECORDS = 50;
let updateQueue = Promise.resolve();
export async function loadBridgeRuns() {
    const runs = await readJson(BRIDGE_RUNS_FILE, []);
    return Array.isArray(runs) ? runs : [];
}
export async function recordBridgeRunStarted(payload, hash, agents) {
    const now = new Date().toISOString();
    const id = `${Date.now().toString(36)}-${hash.slice(0, 8)}`;
    const run = {
        id,
        hash,
        producer: payload.producer,
        event: payload.event,
        cwd: payload.cwd,
        sessionId: payload.sessionId,
        turnId: payload.turnId,
        status: "running",
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        durationMs: null,
        consumers: agents.map((agent) => ({
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
export async function recordConsumerStarted(runId, agent, terminal) {
    await updateRun(runId, (run, now) => {
        run.status = "running";
        const consumer = findConsumer(run, agent);
        consumer.status = "running";
        consumer.startedAt = consumer.startedAt ?? now;
        consumer.completedAt = null;
        if (terminal) {
            consumer.logPath = terminal.logPath;
            consumer.terminalId = terminal.terminalId;
            consumer.terminalBackend = terminal.terminalBackend;
            consumer.tmuxSession = terminal.tmuxSession;
        }
        delete consumer.error;
    });
}
export async function recordConsumerProcessStarted(runId, agent, processInfo) {
    await updateRun(runId, (run) => {
        const consumer = findConsumer(run, agent);
        consumer.pid = processInfo.pid;
        consumer.commandLine = processInfo.commandLine;
    });
}
export async function recordConsumerCompleted(runId, agent, result) {
    await updateRun(runId, (run, now) => {
        const consumer = findConsumer(run, agent);
        consumer.late = run.completedAt !== null && consumer.completedAt === null;
        consumer.status = result.verdict;
        consumer.verdict = result.verdict;
        consumer.summary = result.summary;
        consumer.completedAt = now;
    });
}
export async function recordConsumerError(runId, agent, error) {
    await updateRun(runId, (run, now) => {
        const consumer = findConsumer(run, agent);
        consumer.late = run.completedAt !== null && consumer.completedAt === null;
        consumer.status = "error";
        consumer.error = error instanceof Error ? error.message : String(error);
        consumer.completedAt = now;
    });
}
export async function recordBridgeRunCompleted(runId, response) {
    await updateRun(runId, (run, now) => {
        run.status = response.result.verdict;
        run.summary = response.result.summary;
        run.completedAt = now;
        run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
    });
}
export async function recordBridgeRunTimedOut(runId, response) {
    await updateRun(runId, (run, now) => {
        run.status = "timed_out";
        run.summary = response.result.summary;
        run.completedAt = now;
        run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
    });
}
export async function recordBridgeRunLateCompleted(runId, result) {
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
export async function recordBridgeRunError(runId, error) {
    await updateRun(runId, (run, now) => {
        run.status = "error";
        run.error = error instanceof Error ? error.message : String(error);
        run.completedAt = now;
        run.durationMs = Date.parse(now) - Date.parse(run.startedAt);
    });
}
export async function markInterruptedBridgeRuns(reason = "Agent Bridge service restarted before this run completed.") {
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
function lateStatus(verdict) {
    return verdict === "fail"
        ? "late_fail"
        : verdict === "uncertain"
            ? "late_uncertain"
            : "late_pass";
}
async function updateRun(runId, mutate) {
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
async function updateRuns(mutator) {
    await enqueue(async () => {
        const runs = await loadBridgeRuns();
        const next = mutator(runs)
            .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
            .slice(0, MAX_RUN_RECORDS);
        await writeJson(BRIDGE_RUNS_FILE, next);
    });
}
function enqueue(work) {
    const next = updateQueue.then(work, work);
    updateQueue = next.then(() => undefined, () => undefined);
    return next;
}
function findConsumer(run, agent) {
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
//# sourceMappingURL=run-state.js.map