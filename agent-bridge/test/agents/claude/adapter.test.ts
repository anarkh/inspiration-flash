import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAdapter } from "../../../src/agents/claude/adapter.ts";
import type { Agent } from "../../../src/core/types.ts";

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
