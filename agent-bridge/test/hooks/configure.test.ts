import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildHookCommand, clearHooks, configureAidenHooks, configureCodexHooks, configureClaudeHooks, ensureTomlFeatureHooks } from "../../src/hooks/configure.ts";

test("ensures hooks feature in TOML", () => {
  assert.equal(ensureTomlFeatureHooks("").trim(), "[features]\nhooks = true");
  assert.equal(ensureTomlFeatureHooks("[features]\nfoo = true\n").trim(), "[features]\nhooks = true\nfoo = true");
  assert.equal(ensureTomlFeatureHooks("[features]\nhooks = false\n").trim(), "[features]\nhooks = true");
});

test("writes Codex hook config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-test-"));
  try {
    await configureCodexHooks("project", ["stop", "post-tool-use"], dir);
    const hooks = JSON.parse(await readFile(join(dir, ".codex", "hooks.json"), "utf8"));
    const toml = await readFile(join(dir, ".codex", "config.toml"), "utf8");

    assert.ok(hooks.hooks.Stop);
    assert.ok(hooks.hooks.PostToolUse);
    assert.match(hooks.hooks.Stop[0].hooks[0].command, /hook --producer codex --event stop/);
    assert.match(toml, /hooks = true/);
    assert.doesNotMatch(toml, /codex_hooks/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writes Claude hook config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-test-"));
  try {
    await configureClaudeHooks("project", ["stop"], dir);
    const settings = JSON.parse(await readFile(join(dir, ".claude", "settings.local.json"), "utf8"));

    assert.ok(settings.hooks.Stop);
    assert.match(settings.hooks.Stop[0].hooks[0].command, /hook --producer claude --event stop/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writes Aiden hook config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-test-"));
  try {
    await configureAidenHooks("project", ["stop", "post-tool-use"], dir);
    const settings = JSON.parse(await readFile(join(dir, ".aiden", "settings.json"), "utf8"));

    assert.ok(settings.hooks.Stop);
    assert.ok(settings.hooks.PostToolUse);
    assert.match(settings.hooks.Stop[0].hooks[0].command, /hook --producer aiden --event stop/);
    assert.match(settings.hooks.PostToolUse[0].matcher, /Write/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("clears only managed hooks for the selected producer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-test-"));
  try {
    const codexDir = join(dir, ".codex");
    const hooksPath = join(codexDir, "hooks.json");
    await mkdir(codexDir, { recursive: true });
    await writeFile(hooksPath, `${JSON.stringify({
      hooks: {
        Stop: [{
          hooks: [
            { type: "command", command: "echo keep" },
            { type: "command", command: "node /tmp/bridge hook --producer codex --event stop" },
            { type: "command", command: "node /tmp/bridge hook --producer claude --event stop" }
          ]
        }],
        PostToolUse: [{
          matcher: "apply_patch|Edit|Write",
          hooks: [
            { type: "command", command: "node /tmp/bridge hook --producer codex --event post-tool-use" }
          ]
        }]
      }
    }, null, 2)}\n`, "utf8");

    const changed = await clearHooks({ producers: ["codex"], scope: "project", cwd: dir });
    assert.deepEqual(changed, [hooksPath]);

    const hooks = JSON.parse(await readFile(hooksPath, "utf8"));
    assert.deepEqual(hooks.hooks.Stop[0].hooks.map((hook: { command: string }) => hook.command), [
      "echo keep",
      "node /tmp/bridge hook --producer claude --event stop"
    ]);
    assert.equal(hooks.hooks.PostToolUse, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("builds hook command with absolute entrypoint", () => {
  const original = process.argv[1];
  process.argv[1] = "./src/cli/index.ts";
  try {
    const command = buildHookCommand("codex", "stop");
    assert.match(command, new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(command, /hook --producer codex --event stop/);
  } finally {
    process.argv[1] = original;
  }
});
