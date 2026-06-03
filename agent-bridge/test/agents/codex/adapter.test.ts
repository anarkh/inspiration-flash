import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexAdapter } from "../../../src/agents/clis/codex/adapter.ts";
import type { Agent } from "../../../src/core/types.ts";

test("runs fake Codex agent with stdin and output-last-message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-codex-agent-"));
  try {
    const fake = join(dir, "fake-codex.js");
    await writeFile(fake, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--ask-for-approval")) process.exit(4);
if (!args.includes("--skip-git-repo-check")) process.exit(5);
if (!args.includes("--ephemeral")) process.exit(6);
const disabledFeatures = args.flatMap((arg, index) => arg === "--disable" ? [args[index + 1]] : []);
if (!disabledFeatures.includes("hooks")) process.exit(7);
const out = args[args.indexOf("--output-last-message") + 1];
const prompt = readFileSync(0, "utf8");
if (!prompt.includes("bridge me")) process.exit(8);
writeFileSync(out, JSON.stringify({ verdict: "pass", summary: "ok", findings: [], suggestedPrompt: "" }));
`, "utf8");
    await chmod(fake, 0o755);
    const agent: Agent = {
      id: "codex",
      kind: "codex",
      label: "Codex",
      command: fake,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = await codexAdapter.run(agent, dir, "bridge me");
    assert.equal(result.verdict, "pass");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
