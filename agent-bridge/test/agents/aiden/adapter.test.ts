import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aidenAdapter } from "../../../src/agents/aiden/adapter.ts";
import type { Agent } from "../../../src/core/types.ts";

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
const promptPath = task.split(": ").at(-1);
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
