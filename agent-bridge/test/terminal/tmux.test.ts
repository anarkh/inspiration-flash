import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { Agent } from "../../src/core/types.ts";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tmuxSkipReason = tmuxUnavailableReason();

test("tmux runner executes a consumer command in an interactive terminal session", {
  skip: tmuxSkipReason ?? undefined
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-tmux-"));
  const stateDir = join(dir, "state");
  let tmuxSession: string | undefined;
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?state=${Date.now()}`;
    const tmuxUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "tmux.ts")).href}?state=${Date.now()}`;
    const { createTerminalSession, readTerminalLog } = await import(logsUrl);
    const { attachTmuxRunner, sendTerminalInput } = await import(tmuxUrl);
    const agent: Agent = {
      id: "codex",
      kind: "codex",
      label: "Codex",
      command: process.execPath,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const session = createTerminalSession("tmux-run-1", agent, dir);
    attachTmuxRunner(session, { runId: "tmux-run-1", agent, cwd: dir });
    tmuxSession = session.tmuxSession;
    assert.equal(session.backend, "tmux");
    assert.ok(session.runner);

    const fakeConsumer = join(dir, "fake-consumer.mjs");
    await writeFile(fakeConsumer, [
      "let input = '';",
      "process.stdin.on('data', (chunk) => input += chunk);",
      "process.stdin.on('end', () => console.log(JSON.stringify({ verdict: 'pass', summary: input.trim(), findings: [], suggestedPrompt: '' })));"
    ].join("\n"), "utf8");

    const result = await session.runner.run(process.execPath, [fakeConsumer], "bridge me", {
      cwd: dir,
      timeout: 15_000,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(result.stdout, /Agent Bridge tmux terminal/);
    assert.match(result.stdout, /"verdict":"pass"/);
    await assert.rejects(stat(join(stateDir, "terminals", "tmux-run-1", "command.sh")));

    assert.equal(await sendTerminalInput(session.terminalId, "echo after-run\r"), true);
    await delay(300);
    const log = await readTerminalLog("tmux-run-1", "codex");
    assert.match(log, /after-run/);

    const fakeInteractiveConsumer = join(dir, "fake-interactive-consumer.mjs");
    await writeFile(fakeInteractiveConsumer, [
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (input) => console.log(JSON.stringify({ verdict: 'pass', summary: input.trim(), findings: [], suggestedPrompt: '' })));",
      "setInterval(() => undefined, 1000);"
    ].join("\n"), "utf8");

    const interactiveResult = await session.runner.runTty?.(process.execPath, [fakeInteractiveConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 100,
      terminalInput: "bridge interactive",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.ok(interactiveResult);
    assert.match(interactiveResult.stdout, /bridge interactive/);
    assert.equal(await sendTerminalInput(session.terminalId, "one more\r"), true);
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    if (tmuxSession) {
      spawnSync("tmux", ["kill-session", "-t", tmuxSession], { stdio: "ignore" });
    }
    await rm(dir, { recursive: true, force: true });
  }
});

function tmuxUnavailableReason(): string | null {
  if (spawnSync("tmux", ["-V"], { stdio: "ignore" }).status !== 0) {
    return "tmux is not installed";
  }
  const session = `agent-bridge-probe-${process.pid}`;
  const result = spawnSync("tmux", ["new-session", "-d", "-s", session, "true"], { stdio: "pipe" });
  spawnSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
  return result.status === 0 ? null : `tmux is not usable here: ${String(result.stderr).trim()}`;
}
