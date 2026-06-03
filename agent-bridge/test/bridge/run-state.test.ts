import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("marks stale running bridge runs interrupted on service startup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-run-state-"));
  const stateDir = join(dir, "state");
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const now = new Date(Date.now() - 5_000).toISOString();
    await writeFile(join(stateDir, "bridge-runs.json"), `${JSON.stringify([
      {
        id: "running-run",
        hash: "abc",
        producer: "codex",
        event: "stop",
        cwd: dir,
        sessionId: null,
        turnId: null,
        status: "running",
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        durationMs: null,
        consumers: [{
          kind: "aiden",
          label: "Aiden",
          command: "aiden",
          status: "running",
          startedAt: now,
          completedAt: null
        }]
      },
      {
        id: "timed-out-run",
        hash: "def",
        producer: "codex",
        event: "stop",
        cwd: dir,
        sessionId: null,
        turnId: null,
        status: "timed_out",
        startedAt: now,
        updatedAt: now,
        completedAt: now,
        durationMs: 1,
        consumers: [{
          kind: "aiden",
          label: "Aiden",
          command: "aiden",
          status: "pending",
          startedAt: null,
          completedAt: null
        }]
      }
    ], null, 2)}\n`, "utf8");

    const runStateUrl = `${pathToFileURL(join(repoRoot, "src", "bridge", "run-state.ts")).href}?state=${Date.now()}`;
    const { markInterruptedBridgeRuns } = await import(runStateUrl);
    await markInterruptedBridgeRuns("service restarted");

    const runs = JSON.parse(await readFile(join(stateDir, "bridge-runs.json"), "utf8"));
    const runningRun = runs.find((run: { id: string }) => run.id === "running-run");
    const timedOutRun = runs.find((run: { id: string }) => run.id === "timed-out-run");
    assert.equal(runningRun.status, "interrupted");
    assert.equal(runningRun.consumers[0].status, "interrupted");
    assert.match(runningRun.summary, /service restarted/);
    assert.equal(timedOutRun.status, "timed_out");
    assert.equal(timedOutRun.consumers[0].status, "interrupted");
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
