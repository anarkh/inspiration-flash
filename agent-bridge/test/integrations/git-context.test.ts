import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildBridgePrompt } from "../../src/bridge/prompt.ts";
import { collectGitContext } from "../../src/integrations/git-context.ts";
import type { NormalizedHookPayload } from "../../src/core/types.ts";

const execFileAsync = promisify(execFile);

test("collects reviewable diff for untracked text files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-git-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "dist"), { recursive: true });
    await writeFile(join(dir, "src", "new.ts"), "export const value = 42;\n", "utf8");
    await writeFile(join(dir, "dist", "generated.js"), "export const generated = true;\n", "utf8");

    const git = await collectGitContext(dir);
    assert.equal(git.isGitRepo, true);
    assert.match(git.untrackedDiff, /diff --git a\/src\/new\.ts b\/src\/new\.ts/);
    assert.match(git.untrackedDiff, /\+export const value = 42;/);
    assert.doesNotMatch(git.untrackedDiff, /dist\/generated\.js/);

    const prompt = buildBridgePrompt(payload(dir), git);
    assert.match(prompt, /Untracked files diff:/);
    assert.match(prompt, /\+export const value = 42;/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function payload(cwd: string): NormalizedHookPayload {
  return {
    producer: "codex",
    event: "stop",
    raw: {},
    cwd,
    sessionId: null,
    turnId: null,
    hookEventName: null,
    stopHookActive: false,
    lastAssistantMessage: "done",
    toolName: null,
    toolInput: null,
    toolResponse: null
  };
}
