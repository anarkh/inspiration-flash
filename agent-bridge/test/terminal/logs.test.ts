import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Agent } from "../../src/core/types.ts";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("terminal capture writes a replayable ansi log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-"));
  const stateDir = join(dir, "state");
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?state=${Date.now()}`;
    const { createTerminalSession, readTerminalLog } = await import(logsUrl);
    const agent: Agent = {
      id: "codex",
      kind: "codex",
      label: "Codex",
      command: "codex",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const session = createTerminalSession("run-1", agent, dir);
    session.capture.onStart?.({ pid: 123, command: "codex", args: ["exec", "ok"], cwd: dir });
    session.capture.onStdout?.(Buffer.from("hello\n"));
    session.capture.onStderr?.(Buffer.from("warn\n"));
    session.capture.onClose?.(0);

    await session.flush();
    const log = await readTerminalLog("run-1", "codex");
    assert.match(log, /Agent Bridge terminal/);
    assert.match(log, /pid: 123/);
    assert.match(log, /hello/);
    assert.match(log, /warn/);
    assert.match(log, /process exited with code 0/);
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
