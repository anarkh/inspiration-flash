import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aidenAdapter } from "../../../src/agents/clis/aiden/adapter.ts";
import type { Agent } from "../../../src/core/types.ts";
import type { AgentCommandRunner } from "../../../src/agents/shared/process.ts";

test("runs fake Aiden agent with full context file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-agent-"));
  try {
    const fake = join(dir, "fake-aiden.js");
    await writeFile(fake, `#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (!args.includes("--print")) process.exit(3);
if (args[args.indexOf("--permission-mode") + 1] !== "readOnly") process.exit(4);
if (args.includes("--cwd")) process.exit(5);
if (realpathSync(args[args.indexOf("--workspace") + 1]) !== realpathSync(process.cwd())) process.exit(6);
if (!args.includes("--no-streaming")) process.exit(9);
if (!args.includes("--add-dir")) process.exit(8);
if (args[args.indexOf("--max-turns") + 1] !== "2") process.exit(10);
if (args[args.indexOf("--model-reasoning-effort") + 1] !== "low") process.exit(11);
const task = args.at(-1) ?? "";
const promptPath = task.match(/\\/[^\\n]+review-context-[^\\n]+\\.md/)?.[0];
if (!promptPath) process.exit(12);
const prompt = await readFile(promptPath, "utf8");
if (!prompt.includes("bridge me")) process.exit(7);
console.log(JSON.stringify({ verdict: "pass", summary: "ok", findings: [], suggestedPrompt: "" }));
`, "utf8");
    await chmod(fake, 0o755);
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: fake,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = await aidenAdapter.run(agent, dir, "bridge me");
    assert.equal(result.verdict, "pass", JSON.stringify(result));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runs Aiden through the interactive terminal runner when available", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-tty-"));
  try {
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: "aiden",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run() {
        throw new Error("print mode should not be used when runTty is available");
      },
      async runTty(command, args, options) {
        assert.equal(command, "aiden");
        assert.deepEqual(args, [
          "--permission-mode",
          "readOnly"
        ]);
        assert.equal(args.includes("agentFull"), false);
        assert.equal(args.includes("--print"), false);
        assert.equal(args.includes("--workspace"), false);
        assert.equal(args.includes("--add-dir"), false);
        assert.equal(options.terminalInputMode, "paste");
        assert.match(options.terminalInput, /bridge me/);
        assert.doesNotMatch(options.terminalInput, /review-context-/);
        assert.match(options.terminalInput, /<user_message>/);
        assert.match(options.terminalInput, /<session_id>s1<\/session_id>/);
        assert.match(options.terminalInput, /<agent_bridge_reminder>/);
        assert.doesNotMatch(options.terminalInput, new RegExp(["bot", "mux"].join(""), "i"));
        assert.match(options.terminalInput, /<sender type="agent_bridge" name="Agent Bridge" \/>/);
        assert.ok(options.readyPattern?.test("read-only mode (shift + tab to toggle)"));
        assert.ok(options.busyPattern?.test("Working… (1s · esc to interrupt)"));
        assert.equal(options.timeout, 30 * 60 * 1000);
        assert.equal(options.readyTimeoutMs, 90_000);
        assert.equal(options.readyQuietMs, 1_000);
        assert.equal(options.submitDelayMs, 2_000);
        return {
          stdout: JSON.stringify({ verdict: "pass", summary: "interactive ok", findings: [], suggestedPrompt: "" }),
          stderr: ""
        };
      }
    };

    const result = await aidenAdapter.run(agent, dir, "bridge me", { runner, producerSessionId: "s1" });
    assert.equal(result.verdict, "pass", JSON.stringify(result));
    assert.equal(result.summary, "interactive ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runs Aiden chat through print mode when an interactive runner is available", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-chat-"));
  try {
    const workerContextDir = join(dir, "worker-context");
    const fake = join(dir, "aiden");
    await writeFile(fake, `#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const task = process.argv.at(-1) ?? "";
const promptPath = task.match(/\\/[^\\n]+review-context-[^\\n]+\\.md/)?.[0];
if (!promptPath || !(await readFile(promptPath, "utf8")).includes("plain chat question")) process.exit(2);
console.log("plain chat answer");
`, "utf8");
    await chmod(fake, 0o755);
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: fake,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run() {
        throw new Error("chat mode must not replace the persistent review worker");
      },
      async runTty() {
        throw new Error("chat mode must not wait for a structured TUI result");
      }
    };

    const result = await aidenAdapter.run(agent, dir, "plain chat question", {
      runner,
      workerContextDir,
      outputMode: "chat"
    });
    assert.equal(result.verdict, "pass", JSON.stringify(result));
    assert.equal(result.summary, "plain chat answer");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("passes producer sender and mentions through Aiden terminal input", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-metadata-"));
  try {
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: "aiden",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run() {
        throw new Error("print mode should not be used when runTty is available");
      },
      async runTty(_command, _args, options) {
        assert.match(options.terminalInput, /<sender type="user" open_id="ou_user" name="李晨阳" \/>/);
        assert.match(options.terminalInput, /<mentions>\n  <mention name="艾扥" open_id="ou_bot" \/>\n<\/mentions>/);
        return {
          stdout: JSON.stringify({ verdict: "pass", summary: "metadata ok", findings: [], suggestedPrompt: "" }),
          stderr: ""
        };
      }
    };

    const result = await aidenAdapter.run(agent, dir, "bridge me", {
      runner,
      producerSessionId: "s1",
      producerSender: {
        type: "user",
        openId: "ou_user",
        name: "李晨阳"
      },
      producerMentions: [{
        name: "艾扥",
        openId: "ou_bot"
      }]
    });
    assert.equal(result.summary, "metadata ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("uses a stable worker context directory for interactive Aiden sessions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-aiden-worker-"));
  try {
    const workerContextDir = join(dir, "worker-context");
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: "aiden",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run() {
        throw new Error("print mode should not be used when runTty is available");
      },
      async runTty(_command, args, options) {
        assert.deepEqual(args, ["--permission-mode", "readOnly"]);
        assert.equal(args.includes("agentFull"), false);
        assert.match(options.terminalInput, /bridge me/);
        assert.doesNotMatch(options.terminalInput, /review-context-/);
        return {
          stdout: JSON.stringify({ verdict: "pass", summary: "worker ok", findings: [], suggestedPrompt: "" }),
          stderr: ""
        };
      }
    };

    const result = await aidenAdapter.run(agent, dir, "bridge me", { runner, workerContextDir });
    assert.equal(result.summary, "worker ok");
    await stat(workerContextDir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("exposes Agent Bridge Aiden adapter hooks", () => {
  assert.equal(aidenAdapter.terminalMode, "worker");
  assert.equal(aidenAdapter.terminalInputMode, "paste");
  assert.ok(aidenAdapter.readyPattern?.test("read-only mode (shift + tab to toggle)"));
  assert.deepEqual(aidenAdapter.buildArgs?.({
    sessionId: "s1",
    resume: false,
    workingDir: "/repo"
  }), ["--permission-mode", "readOnly"]);
  assert.deepEqual(aidenAdapter.buildArgs?.({
    sessionId: "s1",
    resume: true,
    workingDir: "/repo"
  }), ["--resume", "s1", "--permission-mode", "readOnly"]);
  assert.equal(aidenAdapter.buildResumeCommand?.({ sessionId: "s1" }), "aiden --resume s1");
});
