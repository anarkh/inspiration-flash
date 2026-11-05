import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("terminal stream targets the persistent worker terminal after a run completes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-service-terminal-"));
  const stateDir = join(dir, "state");
  const runLog = join(dir, "run.ansi.log");
  const workerLog = join(dir, "worker.ansi.log");
  const captureRunLog = join(dir, "capture-run.ansi.log");
  const missingCaptureWorkerLog = join(dir, "missing-capture-worker.ansi.log");
  const now = new Date().toISOString();
  try {
    await mkdir(stateDir);
    await writeFile(runLog, "run log", "utf8");
    await writeFile(workerLog, "worker log", "utf8");
    await writeFile(captureRunLog, "capture run log", "utf8");
    await writeFile(join(stateDir, "bridge-runs.json"), `${JSON.stringify([{
      id: "run-1",
      hash: "hash",
      producer: "codex",
      event: "stop",
      cwd: dir,
      sessionId: "producer-session-1",
      turnId: null,
      status: "pass",
      startedAt: now,
      updatedAt: now,
      completedAt: now,
      durationMs: 10,
      consumers: [{
        kind: "aiden",
        label: "Aiden",
        command: "aiden",
        status: "pass",
        startedAt: now,
        completedAt: now,
        logPath: runLog,
        workerLogPath: workerLog,
        terminalId: "worker:codex-aiden-repo-producer-session-1:aiden",
        terminalBackend: "tmux",
        tmuxSession: "agent-bridge-worker",
        workerId: "codex-aiden-repo-producer-session-1",
        workerKey: "worker-key"
      }]
    }, {
      id: "run-2",
      hash: "capture-hash",
      producer: "codex",
      event: "stop",
      cwd: dir,
      sessionId: "producer-session-2",
      turnId: null,
      status: "pass",
      startedAt: now,
      updatedAt: now,
      completedAt: now,
      durationMs: 10,
      consumers: [{
        kind: "claude",
        label: "Claude Code",
        command: "claude",
        status: "pass",
        startedAt: now,
        completedAt: now,
        logPath: captureRunLog,
        workerLogPath: missingCaptureWorkerLog,
        terminalId: "worker:codex-claude-repo-producer-session-2:claude",
        terminalBackend: "capture",
        workerId: "codex-claude-repo-producer-session-2",
        workerKey: "capture-worker-key"
      }]
    }], null, 2)}\n`, "utf8");

    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const serviceUrl = `${pathToFileURL(join(repoRoot, "src", "service", "server.ts")).href}?state=${Date.now()}`;
    const { terminalTarget } = await import(serviceUrl);

    assert.deepEqual(await terminalTarget("run-1", "aiden", "log"), {
      terminalId: "run-1:aiden",
      logPath: runLog,
      tail: false
    });
    assert.deepEqual(await terminalTarget("run-1", "aiden", "stream"), {
      terminalId: "worker:codex-aiden-repo-producer-session-1:aiden",
      logPath: workerLog,
      tail: true
    });
    assert.deepEqual(await terminalTarget("run-1", "aiden", "ws"), {
      terminalId: "worker:codex-aiden-repo-producer-session-1:aiden",
      logPath: workerLog,
      tail: true
    });
    assert.deepEqual(await terminalTarget("run-2", "claude", "ws"), {
      terminalId: "run-2:claude",
      logPath: captureRunLog,
      tail: true
    });
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
