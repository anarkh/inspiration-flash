import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("does not let a non-reviewable stop baseline hide the next reviewable diff", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-runner-baseline-"));
  const projectDir = join(dir, "repo");
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  const promptsPath = join(dir, "prompts.txt");
  const fakeAgent = join(dir, "fake-claude.mjs");
  const driver = join(dir, "driver.mjs");
  try {
    await mkdir(projectDir);
    await mkdir(configDir);
    await mkdir(stateDir);
    await mkdir(join(projectDir, "src"), { recursive: true });
    await writeFile(join(projectDir, "src", "example.ts"), "export const changed = false;\n", "utf8");
    await git(projectDir, "init");
    await git(projectDir, "config", "user.email", "agent-bridge@example.test");
    await git(projectDir, "config", "user.name", "Agent Bridge Test");
    await git(projectDir, "add", ".");
    await git(projectDir, "commit", "-m", "init");
    await writeFile(join(projectDir, "src", "example.ts"), "export const changed = true;\n", "utf8");

    await writeFile(fakeAgent, `#!/usr/bin/env node
import { appendFile } from "node:fs/promises";

const promptsPath = ${JSON.stringify(promptsPath)};
let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  stdin += chunk;
}
await appendFile(promptsPath, "\\n---PROMPT---\\n" + stdin, "utf8");
console.log(JSON.stringify({ verdict: "pass", summary: "ok", findings: [], suggestedPrompt: "" }));
`, "utf8");
    await chmod(fakeAgent, 0o755);

    const now = new Date().toISOString();
    await writeFile(join(configDir, "config.json"), `${JSON.stringify({
      port: 47743,
      uncertainBehavior: "continue",
      agents: [{
        id: "claude",
        kind: "claude",
        label: "Claude Code",
        command: fakeAgent,
        enabled: true,
        createdAt: now,
        updatedAt: now
      }],
      routes: [{
        producer: "codex",
        consumers: ["claude"],
        enabled: true,
        createdAt: now,
        updatedAt: now
      }]
    }, null, 2)}\n`, "utf8");

    await writeFile(driver, `
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { runBridge } = await import(${JSON.stringify(pathToFileURL(join(repoRoot, "src", "bridge", "runner.ts")).href)});
const projectDir = process.env.PROJECT_DIR;
const stateDir = process.env.AGENT_BRIDGE_STATE_DIR;
const promptsPath = process.env.PROMPTS_PATH;
const baselinePath = join(stateDir, "session-git-baselines.json");

const first = await runBridge({
  producer: "codex",
  event: "stop",
  raw: {
    cwd: projectDir,
    session_id: "s1",
    hook_event_name: "Stop",
    last_assistant_message: "你好，有什么可以帮你？"
  }
});
assert.equal(first.result.verdict, "pass", JSON.stringify(first));
assert.equal(existsSync(baselinePath), false, "non-reviewable stop must not record a git baseline");

const second = await runBridge({
  producer: "codex",
  event: "stop",
  raw: {
    cwd: projectDir,
    session_id: "s1",
    hook_event_name: "Stop",
    last_assistant_message: "已修改 src/example.ts 并完成实现。"
  }
});
assert.equal(second.result.verdict, "pass", JSON.stringify(second));
assert.equal(existsSync(baselinePath), true, "passing reviewable stop should record a git baseline");

const prompts = readFileSync(promptsPath, "utf8").split("---PROMPT---").filter((value) => value.trim().length > 0);
assert.equal(prompts.length, 2);
assert.match(prompts[1], /src\\/example\\.ts/);
assert.match(prompts[1], /export const changed = true/);
assert.doesNotMatch(prompts[1], /Unstaged diff:\\n\\(omitted\\)/);
`, "utf8");

    await runNode(driver, {
      AGENT_BRIDGE_CONFIG_DIR: configDir,
      AGENT_BRIDGE_STATE_DIR: stateDir,
      AGENT_BRIDGE_TERMINAL_BACKEND: "capture",
      AGENT_BRIDGE_GATE_TIMEOUT_MS: "30000",
      PROJECT_DIR: projectDir,
      PROMPTS_PATH: promptsPath
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function runNode(script: string, env: NodeJS.ProcessEnv): Promise<void> {
  try {
    await execFileAsync(process.execPath, [script], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env
      },
      timeout: 60_000,
      maxBuffer: 1_000_000
    });
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string };
    throw new Error([
      execError.message,
      execError.stdout,
      execError.stderr
    ].filter(Boolean).join("\n"));
  }
}
