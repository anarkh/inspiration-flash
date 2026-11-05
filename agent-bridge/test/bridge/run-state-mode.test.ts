import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("records direct send output mode for dashboard history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-run-mode-"));
  const stateDir = join(dir, "state");
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const runStateUrl = `${pathToFileURL(join(repoRoot, "src", "bridge", "run-state.ts")).href}?mode=${Date.now()}`;
    const { recordBridgeRunStarted } = await import(runStateUrl);

    await recordBridgeRunStarted({
      producer: "codex",
      event: "stop",
      raw: {},
      cwd: dir,
      sessionId: "s1",
      turnId: null,
      hookEventName: "DirectSend",
      stopHookActive: false,
      lastAssistantMessage: "hello chat",
      toolName: null,
      toolInput: null,
      toolResponse: null,
      sender: null,
      mentions: []
    }, "abcdef123456", [{
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: "claude",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }], {
      source: "direct",
      directMessagePreview: "hello chat",
      outputMode: "chat"
    });
    await recordBridgeRunStarted({
      producer: "codex",
      event: "stop",
      raw: {},
      cwd: dir,
      sessionId: "s1",
      turnId: null,
      hookEventName: "DirectSend",
      stopHookActive: false,
      lastAssistantMessage: "review this",
      toolName: null,
      toolInput: null,
      toolResponse: null,
      sender: null,
      mentions: []
    }, "fedcba654321", [{
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: "claude",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }], {
      source: "direct",
      directMessagePreview: "review this",
      outputMode: "review"
    });

    const runs = JSON.parse(await readFile(join(stateDir, "bridge-runs.json"), "utf8"));
    assert.equal(runs[0].outputMode, "review");
    assert.equal(runs[1].outputMode, "chat");
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
