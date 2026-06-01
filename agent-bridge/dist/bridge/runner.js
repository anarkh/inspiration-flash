import { loadConfig } from "../config/store.js";
import { bridgeGateTimeoutMs, BYPASS_ENV } from "../core/constants.js";
import { normalizeHookPayload, bridgeHash } from "../hooks/payload.js";
import { runAgent } from "../agents/registry.js";
import { commandErrorResult } from "../agents/shared/errors.js";
import { collectGitContext } from "../integrations/git-context.js";
import { createTerminalSession, formatCommandLine } from "../terminal/logs.js";
import { attachTmuxRunner } from "../terminal/tmux.js";
import { isDuplicateBridge, rememberBridge } from "./recent.js";
import { buildBridgePrompt } from "./prompt.js";
import { recordBridgeRunCompleted, recordBridgeRunError, recordBridgeRunLateCompleted, recordBridgeRunStarted, recordBridgeRunTimedOut, recordConsumerCompleted, recordConsumerError, recordConsumerProcessStarted, recordConsumerStarted } from "./run-state.js";
export async function runBridge(envelope) {
    const payload = normalizeHookPayload(envelope.producer, envelope.event, envelope.raw);
    if (process.env[BYPASS_ENV] === "1" || payload.stopHookActive) {
        return passResponse("Bridge skipped to avoid recursive hook execution.");
    }
    const hash = bridgeHash(payload);
    if (await isDuplicateBridge(hash)) {
        return {
            ...passResponse("Duplicate bridge skipped."),
            duplicate: true
        };
    }
    await rememberBridge(hash);
    const config = await loadConfig();
    const agents = selectRouteAgents(config, payload.producer);
    if (agents.length === 0) {
        return passResponse(`No enabled consumer route configured for ${payload.producer}. Run \`agent-bridge setup\` to map this producer to consumer agents.`);
    }
    const runId = await recordBridgeRunStarted(payload, hash, agents).catch(() => null);
    try {
        const git = await collectGitContext(payload.cwd);
        const prompt = buildBridgePrompt(payload, git);
        const tasks = agents.map((agent) => startConsumerTask(runId, agent, payload.cwd, prompt));
        const outcome = await waitForGate(tasks, config);
        const response = outcome.response;
        if (runId) {
            if (response.timedOut) {
                await recordBridgeRunTimedOut(runId, response).catch(() => undefined);
            }
            else {
                await recordBridgeRunCompleted(runId, response).catch(() => undefined);
            }
            if (!outcome.completedAll) {
                void recordLateCompletion(runId, tasks).catch(() => undefined);
            }
        }
        return response;
    }
    catch (error) {
        if (runId) {
            await recordBridgeRunError(runId, error).catch(() => undefined);
        }
        throw error;
    }
}
function startConsumerTask(runId, agent, cwd, prompt) {
    return {
        agent,
        promise: (async () => {
            const onProcessStart = (info) => {
                if (!runId) {
                    return;
                }
                void recordConsumerProcessStarted(runId, agent, {
                    pid: info.pid,
                    commandLine: formatCommandLine(info.command, info.args)
                }).catch(() => undefined);
            };
            const terminal = runId
                ? createTerminalSession(runId, agent, cwd, onProcessStart)
                : null;
            if (terminal && runId) {
                attachTmuxRunner(terminal, {
                    runId,
                    agent,
                    cwd,
                    onStart: onProcessStart
                });
            }
            if (runId) {
                await recordConsumerStarted(runId, agent, terminal
                    ? {
                        logPath: terminal.logPath,
                        terminalId: terminal.terminalId,
                        terminalBackend: terminal.backend,
                        tmuxSession: terminal.tmuxSession
                    }
                    : undefined).catch(() => undefined);
            }
            try {
                const result = await runAgent(agent, cwd, prompt, {
                    capture: terminal?.capture,
                    runner: terminal?.runner
                });
                if (runId) {
                    await recordConsumerCompleted(runId, agent, result).catch(() => undefined);
                }
                return result;
            }
            catch (error) {
                if (runId) {
                    await recordConsumerError(runId, agent, error).catch(() => undefined);
                }
                return commandErrorResult(agent, error);
            }
        })()
    };
}
async function waitForGate(tasks, config) {
    const timeoutMs = bridgeGateTimeoutMs();
    const timeout = createTimeout(timeoutMs);
    const pending = new Set(tasks);
    const results = [];
    try {
        while (pending.size > 0) {
            const next = await Promise.race([
                timeout.promise,
                ...[...pending].map((task) => task.promise.then((result) => ({
                    type: "result",
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
    }
    finally {
        timeout.cancel();
    }
}
async function recordLateCompletion(runId, tasks) {
    const settled = await Promise.all(tasks.map((task) => task.promise));
    await recordBridgeRunLateCompleted(runId, combineResults(settled));
}
export function selectRouteAgents(config, producer) {
    const route = config.routes.find((item) => item.enabled && item.producer === producer);
    if (!route) {
        return [];
    }
    const consumers = new Set(route.consumers);
    return config.agents.filter((agent) => agent.enabled && consumers.has(agent.kind));
}
function combineResults(results) {
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
function responseFromResult(result, config) {
    return {
        shouldContinue: result.verdict === "fail" || (result.verdict === "uncertain" && config.uncertainBehavior === "continue"),
        result
    };
}
function timedOutResponse(timeoutMs) {
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
function passResponse(summary) {
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
function formatDuration(ms) {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m${rest}s`;
}
function createTimeout(ms) {
    let timer;
    const promise = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ type: "timeout" }), ms);
        timer.unref?.();
    });
    return {
        promise,
        cancel: () => clearTimeout(timer)
    };
}
//# sourceMappingURL=runner.js.map