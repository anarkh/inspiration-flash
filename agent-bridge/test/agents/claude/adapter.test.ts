import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAdapter } from "../../../src/agents/clis/claude-code/adapter.ts";
import type { Agent } from "../../../src/core/types.ts";
import type { AgentCommandRunner } from "../../../src/agents/shared/process.ts";

test("runs fake Claude agent with stdin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-claude-agent-"));
  try {
    const fake = join(dir, "fake-claude.js");
    await writeFile(fake, `#!/usr/bin/env node
import { readFileSync } from "node:fs";
const prompt = readFileSync(0, "utf8");
if (!prompt.includes("bridge me")) process.exit(3);
console.log(JSON.stringify({ result: JSON.stringify({ verdict: "fail", summary: "bad", findings: ["issue"], suggestedPrompt: "fix it" }) }));
`, "utf8");
    await chmod(fake, 0o755);
    const agent: Agent = {
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: fake,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = await claudeAdapter.run(agent, dir, "bridge me");
    assert.equal(result.verdict, "fail");
    assert.equal(result.findings[0].title, "issue");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runs Claude through the persistent worker command runner when available", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-claude-tty-"));
  try {
    const agent: Agent = {
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: "claude",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run(command, args, input) {
        assert.equal(command, "claude");
        assert.deepEqual(args, [
          "-p",
          "--output-format",
          "json",
          "--permission-mode",
          "plan",
          "--max-turns",
          "3"
        ]);
        assert.match(input, /bridge me/);
        return {
          stdout: JSON.stringify({ type: "result", result: JSON.stringify({ verdict: "pass", summary: "persistent command ok", findings: [], suggestedPrompt: "" }) }),
          stderr: ""
        };
      },
      async runTty() {
        throw new Error("interactive Claude TUI should not be used for default worker history");
      }
    };

    const result = await claudeAdapter.run(agent, dir, "bridge me", { runner, producerSessionId: "s1" });
    assert.equal(result.verdict, "pass", JSON.stringify(result));
    assert.equal(result.summary, "persistent command ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("exposes Agent Bridge Claude adapter hooks", () => {
  assert.equal(claudeAdapter.terminalMode, "worker");
});

test("uses the configured Claude maximum turn count", async () => {
  const previous = process.env.AGENT_BRIDGE_CLAUDE_MAX_TURNS;
  process.env.AGENT_BRIDGE_CLAUDE_MAX_TURNS = "7";
  try {
    const agent: Agent = {
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: "claude",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const runner: AgentCommandRunner = {
      async run(_command, args) {
        assert.equal(args.at(-1), "7");
        return {
          stdout: JSON.stringify({ type: "result", result: JSON.stringify({ verdict: "pass", summary: "configured", findings: [], suggestedPrompt: "" }) }),
          stderr: ""
        };
      }
    };

    const result = await claudeAdapter.run(agent, process.cwd(), "configured turns", { runner });
    assert.equal(result.summary, "configured");
  } finally {
    if (previous === undefined) {
      delete process.env.AGENT_BRIDGE_CLAUDE_MAX_TURNS;
    } else {
      process.env.AGENT_BRIDGE_CLAUDE_MAX_TURNS = previous;
    }
  }
});
