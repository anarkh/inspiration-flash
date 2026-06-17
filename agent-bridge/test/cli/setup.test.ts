import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const cliEntry = join(repoRoot, "src", "cli", "index.ts");

test("setup configures producer hooks and consumer agent in one flow", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-setup-"));
  const projectDir = join(dir, "project");
  try {
    await mkdir(projectDir);
    const result = await runCli(["setup"], projectDir, join(dir, "config"), join(dir, "state"));

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Configured consumer routes:/);
    assert.match(result.stdout, /Codex -> Codex/);
    assert.match(result.stdout, /Configured consumer agents:/);
    assert.match(result.stdout, /Codex -> .*codex/);
    assert.match(result.stdout, /Configured hooks:/);

    const hooks = JSON.parse(await readFile(join(projectDir, ".codex", "hooks.json"), "utf8"));
    assert.match(hooks.hooks.Stop[0].hooks[0].command, /hook --producer codex --event stop/);
    assert.equal(hooks.hooks.PostToolUse, undefined);

    const config = JSON.parse(await readFile(join(dir, "config", "config.json"), "utf8"));
    assert.equal(config.agents[0].kind, "codex");
    assert.match(config.agents[0].command, /codex$/);
    assert.deepEqual(config.routes[0].producer, "codex");
    assert.deepEqual(config.routes[0].consumers, ["codex"]);

    const list = await runCli(["list"], projectDir, join(dir, "config"), join(dir, "state"));
    assert.equal(list.code, 0, list.stderr);
    assert.match(list.stdout, /Configured routes:/);
    assert.match(list.stdout, /enabled Codex -> Codex \(.*codex\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hooks clear removes configured project hooks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-clear-"));
  const projectDir = join(dir, "project");
  try {
    await mkdir(projectDir);
    const configDir = join(dir, "config");
    const stateDir = join(dir, "state");
    const setup = await runCli(["setup"], projectDir, configDir, stateDir);
    assert.equal(setup.code, 0, setup.stderr);

    const result = await runCli(["hooks", "clear"], projectDir, configDir, stateDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Cleared hooks:/);

    const hooks = JSON.parse(await readFile(join(projectDir, ".codex", "hooks.json"), "utf8"));
    assert.equal(hooks.hooks.Stop, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("remove producer deletes route, prunes consumers, and clears hooks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-remove-"));
  const projectDir = join(dir, "project");
  try {
    await mkdir(projectDir);
    const configDir = join(dir, "config");
    const stateDir = join(dir, "state");
    const setup = await runCli(["setup"], projectDir, configDir, stateDir);
    assert.equal(setup.code, 0, setup.stderr);

    const result = await runCli(["remove", "--producer", "codex", "--scope", "project"], projectDir, configDir, stateDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Removed route: Codex -> Codex/);
    assert.match(result.stdout, /Cleared hooks:/);

    const config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8"));
    assert.deepEqual(config.routes, []);
    assert.deepEqual(config.agents, []);

    const hooks = JSON.parse(await readFile(join(projectDir, ".codex", "hooks.json"), "utf8"));
    assert.equal(hooks.hooks.Stop, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("remove tolerates a deleted current working directory when PWD is available", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-remove-deleted-cwd-"));
  const projectDir = join(dir, "project");
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  try {
    await mkdir(projectDir);
    const setup = await runCli(["setup"], projectDir, configDir, stateDir);
    assert.equal(setup.code, 0, setup.stderr);

    const script = join(dir, "remove-deleted-cwd.mjs");
    await writeFile(script, `
import { rmSync } from "node:fs";
import { chdir } from "node:process";
chdir(${JSON.stringify(projectDir)});
rmSync(${JSON.stringify(projectDir)}, { recursive: true, force: true });
process.argv = [process.execPath, ${JSON.stringify(cliEntry)}, "remove", "--producer", "codex", "--scope", "project"];
await import(${JSON.stringify(pathToFileURL(cliEntry).href)});
await new Promise((resolve) => setTimeout(resolve, 250));
`, "utf8");

    const result = await runNodeScript(script, dir, configDir, stateDir, {
      extraEnv: { PWD: projectDir }
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Removed route: Codex -> Codex/);
    assert.match(result.stdout, /No matching Agent Bridge hooks found/);
    assert.doesNotMatch(result.stderr, /uv_cwd|process\.cwd/);

    const config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8"));
    assert.deepEqual(config.routes, []);
    assert.deepEqual(config.agents, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("help exposes top-level lifecycle commands without service namespace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-help-"));
  try {
    const result = await runCli(["--help"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /\nUsage:\n  agent-bridge <command> \[options\]\n/);
    assert.match(result.stdout, /\n  help \[command\]\n/);
    assert.match(result.stdout, /\n  version\n/);
    assert.match(result.stdout, /\n  list\n/);
    assert.match(result.stdout, /\n  remove \[--producer codex\|claude\|aiden\|--all\] \[--scope project\|global\|both\]\n/);
    assert.match(result.stdout, /\n  start\n/);
    assert.match(result.stdout, /\n  status\n/);
    assert.match(result.stdout, /\n  dashboard\n/);
    assert.match(result.stdout, /\n  stop\n/);
    assert.doesNotMatch(result.stdout, /service start|service run/);
    assert.doesNotMatch(result.stdout, /agent list|agent add|agent remove/);

    const command = await runCli(["help"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(command.code, 0, command.stderr);
    assert.equal(command.stdout, result.stdout);

    const send = await runCli(["help", "send"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(send.code, 0, send.stderr);
    assert.match(send.stdout, /Usage:\n  agent-bridge send --to codex\|claude\|aiden --message <text>/);
    assert.match(send.stdout, /direct validation message/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("version command prints the package version", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-version-"));
  try {
    const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as { version: string };
    const expected = `${packageJson.version}\n`;

    const command = await runCli(["version"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(command.code, 0, command.stderr);
    assert.equal(command.stdout, expected);
    assert.equal(command.stderr, "");

    const longFlag = await runCli(["--version"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(longFlag.code, 0, longFlag.stderr);
    assert.equal(longFlag.stdout, expected);
    assert.equal(longFlag.stderr, "");

    const shortFlag = await runCli(["-v"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(shortFlag.code, 0, shortFlag.stderr);
    assert.equal(shortFlag.stdout, expected);
    assert.equal(shortFlag.stderr, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("status shows active consumer agent progress", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-status-"));
  const projectDir = join(dir, "project");
  const stateDir = join(dir, "state");
  try {
    await mkdir(projectDir);
    await mkdir(stateDir);
    const now = new Date(Date.now() - 2_000).toISOString();
    await writeFile(join(stateDir, "bridge-runs.json"), `${JSON.stringify([{
      id: "run-1",
      hash: "abc",
      producer: "codex",
      event: "stop",
      cwd: projectDir,
      sessionId: null,
      turnId: null,
      status: "running",
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      durationMs: null,
      consumers: [{
        kind: "claude",
        label: "Claude Code",
        command: "claude",
        status: "running",
        startedAt: now,
        completedAt: null
      }]
    }], null, 2)}\n`, "utf8");

    const result = await runCli(["status"], projectDir, join(dir, "config"), stateDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Service: not running/);
    assert.match(result.stdout, /Active bridge runs:/);
    assert.match(result.stdout, /run-1 Codex stop running/);
    assert.match(result.stdout, /Claude Code: running .*claude/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("status treats timed out runs with interrupted consumers as recent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-timeout-status-"));
  const projectDir = join(dir, "project");
  const stateDir = join(dir, "state");
  try {
    await mkdir(projectDir);
    await mkdir(stateDir);
    const now = new Date(Date.now() - 2_000).toISOString();
    await writeFile(join(stateDir, "bridge-runs.json"), `${JSON.stringify([{
      id: "run-1",
      hash: "abc",
      producer: "codex",
      event: "stop",
      cwd: projectDir,
      sessionId: null,
      turnId: null,
      status: "timed_out",
      startedAt: now,
      updatedAt: now,
      completedAt: now,
      durationMs: 1,
      consumers: [{
        kind: "aiden",
        label: "Aiden",
        command: "aiden",
        status: "interrupted",
        startedAt: now,
        completedAt: now
      }]
    }], null, 2)}\n`, "utf8");

    const result = await runCli(["status"], projectDir, join(dir, "config"), stateDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Active bridge runs: none/);
    assert.match(result.stdout, /Recent bridge runs:/);
    assert.match(result.stdout, /run-1 Codex stop timed_out \(producer released\)/);
    assert.match(result.stdout, /Aiden: interrupted .*aiden/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bridge releases producer after bounded gate and records late result", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-gate-"));
  const projectDir = join(dir, "project");
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  try {
    await mkdir(projectDir);
    await mkdir(configDir);
    await mkdir(stateDir);
    const fakeClaude = join(dir, "fake-claude.js");
    await writeFile(fakeClaude, `#!${process.execPath}
process.stdin.resume();
process.stdin.on("end", () => {
  setTimeout(() => {
    console.log(JSON.stringify({ verdict: "pass", summary: "late pass", findings: [], suggestedPrompt: "" }));
  }, 250);
});
`, "utf8");
    await chmod(fakeClaude, 0o755);
    const now = new Date().toISOString();
    await writeFile(join(configDir, "config.json"), `${JSON.stringify({
      port: 47743,
      uncertainBehavior: "continue",
      agents: [{
        id: "claude",
        kind: "claude",
        label: "Claude Code",
        command: fakeClaude,
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

    const script = join(dir, "run-bridge.mjs");
    await writeFile(script, `
import assert from "node:assert/strict";
const { runBridge } = await import(${JSON.stringify(pathToFileURL(join(repoRoot, "src", "bridge", "runner.ts")).href)});
const started = Date.now();
const response = await runBridge({
  producer: "codex",
  event: "stop",
  raw: { cwd: ${JSON.stringify(projectDir)}, last_assistant_message: "done" }
});
const elapsed = Date.now() - started;
assert.equal(response.shouldContinue, false);
assert.equal(response.timedOut, true);
assert.ok(elapsed < 1000, "runBridge took " + elapsed + "ms");
await new Promise((resolve) => setTimeout(resolve, 700));
console.log(JSON.stringify({ elapsed, response }));
`, "utf8");

    const result = await runNodeScript(script, projectDir, configDir, stateDir, {
      extraEnv: { AGENT_BRIDGE_GATE_TIMEOUT_MS: "50" }
    });
    assert.equal(result.code, 0, result.stderr);

    const runs = JSON.parse(await readFile(join(stateDir, "bridge-runs.json"), "utf8"));
    assert.equal(runs[0].status, "late_pass");
    assert.equal(runs[0].consumers[0].late, true);
    assert.equal(runs[0].consumers[0].status, "pass");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("send posts a direct Aiden message through the service and prints JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-send-aiden-"));
  const projectDir = join(dir, "project");
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  const contextPath = join(dir, "seen-context.txt");
  try {
    await mkdir(projectDir);
    await mkdir(configDir);
    await mkdir(stateDir);
    const fakeAiden = join(dir, "fake-aiden.mjs");
    await writeFile(fakeAiden, `#!${process.execPath}
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const promptArg = process.argv.at(-1) ?? "";
const match = promptArg.match(/Read the bridge context file and return only the requested JSON:\\n([^<\\n]+)/);
const contextPath = match?.[1]?.trim() ?? "";
const context = contextPath && existsSync(contextPath) ? readFileSync(contextPath, "utf8") : "";
writeFileSync(process.env.AGENT_BRIDGE_TEST_CONTEXT ?? "", context);
console.log(JSON.stringify({
  verdict: "pass",
  summary: context.includes("hello direct") && context.includes('"sessionId": "s1"') ? "saw direct aiden" : "missing direct context",
  findings: [],
  suggestedPrompt: ""
}));
`, "utf8");
    await chmod(fakeAiden, 0o755);
    await writeConfig(configDir, await freePort(), [{
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: fakeAiden,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]);

    const result = await runCli([
      "send",
      "--to",
      "aiden",
      "--message",
      "hello direct",
      "--workspace",
      projectDir,
      "--session-id",
      "s1"
    ], projectDir, configDir, stateDir, {
      extraEnv: {
        AGENT_BRIDGE_TERMINAL_BACKEND: "capture",
        AGENT_BRIDGE_TEST_CONTEXT: contextPath
      }
    });
    assert.equal(result.code, 0, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.equal(response.result.summary, "saw direct aiden");
    assert.equal("rawOutput" in response.result, false);
    const context = await readFile(contextPath, "utf8");
    assert.match(context, /Direct message:/);
    assert.match(context, /hello direct/);
    assert.match(context, /"consumer": "aiden"/);

    const rawResult = await runCli([
      "send",
      "--to",
      "aiden",
      "--message",
      "hello direct",
      "--workspace",
      projectDir,
      "--session-id",
      "s1",
      "--raw-output"
    ], projectDir, configDir, stateDir, {
      extraEnv: {
        AGENT_BRIDGE_TERMINAL_BACKEND: "capture",
        AGENT_BRIDGE_TEST_CONTEXT: contextPath
      }
    });
    assert.equal(rawResult.code, 0, rawResult.stderr);
    const rawResponse = JSON.parse(rawResult.stdout);
    assert.match(rawResponse.result.rawOutput, /saw direct aiden/);

    const runs = JSON.parse(await readFile(join(stateDir, "bridge-runs.json"), "utf8"));
    assert.equal(runs[0].source, "direct");
    assert.equal(runs[0].directMessagePreview, "hello direct");
    assert.equal(runs[0].consumers[0].kind, "aiden");
  } finally {
    await runCli(["stop"], projectDir, configDir, stateDir).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
});

test("send reads stdin and file messages and does not de-duplicate direct repeats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-send-message-"));
  const projectDir = join(dir, "project");
  const configDir = join(dir, "config");
  const stateDir = join(dir, "state");
  const countPath = join(dir, "count.txt");
  try {
    await mkdir(projectDir);
    await mkdir(configDir);
    await mkdir(stateDir);
    const fakeClaude = join(dir, "fake-claude.mjs");
    await writeFile(fakeClaude, `#!${process.execPath}
import { appendFileSync, readFileSync } from "node:fs";
let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  appendFileSync(process.env.AGENT_BRIDGE_TEST_COUNT ?? "", "x");
  const count = readFileSync(process.env.AGENT_BRIDGE_TEST_COUNT ?? "", "utf8").length;
  const summary = input.includes("file direct") ? "file direct" : input.includes("repeat direct") ? "repeat direct " + count : "missing direct";
  console.log(JSON.stringify({ verdict: "pass", summary, findings: [], suggestedPrompt: "" }));
});
`, "utf8");
    await chmod(fakeClaude, 0o755);
    await writeConfig(configDir, await freePort(), [{
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: fakeClaude,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]);

    const first = await runCli(["send", "--to", "claude", "--workspace", projectDir, "--session-id", "stdin-session"], projectDir, configDir, stateDir, {
      input: "repeat direct",
      extraEnv: { AGENT_BRIDGE_TEST_COUNT: countPath }
    });
    assert.equal(first.code, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).result.summary, "repeat direct 1");

    const second = await runCli(["send", "--to", "claude", "--workspace", projectDir, "--session-id", "stdin-session"], projectDir, configDir, stateDir, {
      input: "repeat direct",
      extraEnv: { AGENT_BRIDGE_TEST_COUNT: countPath }
    });
    assert.equal(second.code, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).result.summary, "repeat direct 2");

    const messageFile = join(dir, "message.txt");
    await writeFile(messageFile, "file direct", "utf8");
    const fileResult = await runCli(["send", "--to", "claude", "--file", messageFile, "--workspace", projectDir], projectDir, configDir, stateDir, {
      extraEnv: { AGENT_BRIDGE_TEST_COUNT: countPath }
    });
    assert.equal(fileResult.code, 0, fileResult.stderr);
    assert.equal(JSON.parse(fileResult.stdout).result.summary, "file direct");

    const config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8"));
    assert.deepEqual(config.routes, []);
  } finally {
    await runCli(["stop"], projectDir, configDir, stateDir).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  }
});

test("send validates the target and message source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-send-validation-"));
  try {
    const missingTarget = await runCli(["send", "--message", "hello"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(missingTarget.code, 1);
    assert.match(missingTarget.stderr, /--to must be codex, claude, or aiden/);

    const conflictingSources = await runCli(["send", "--to", "aiden", "--message", "hello", "--file", "message.txt"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(conflictingSources.code, 1);
    assert.match(conflictingSources.stderr, /exactly one direct message source/);

    const pipedConflict = await runCli(["send", "--to", "aiden", "--message", "hello"], dir, join(dir, "config"), join(dir, "state"), {
      input: "stdin hello"
    });
    assert.equal(pipedConflict.code, 1);
    assert.match(pipedConflict.stderr, /exactly one direct message source/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("agent namespace is no longer a public command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-agent-add-"));
  try {
    const add = await runCli(["agent", "add"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(add.code, 1);
    assert.match(add.stderr, /Unknown command: agent\. Use `agent-bridge list`\./);

    const list = await runCli(["agent", "list"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(list.code, 1);
    assert.match(list.stderr, /Unknown command: agent\. Use `agent-bridge list`\./);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("service namespace is no longer a public command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-service-"));
  try {
    const result = await runCli(["service", "status"], dir, join(dir, "config"), join(dir, "state"));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown command: service/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

interface RunCliOptions {
  input?: string;
  extraEnv?: NodeJS.ProcessEnv;
}

function runCli(args: string[], cwd: string, configDir: string, stateDir: string, options: RunCliOptions = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: undefined,
        AGENT_BRIDGE_CONFIG_DIR: configDir,
        AGENT_BRIDGE_STATE_DIR: stateDir,
        ...options.extraEnv,
        PATH: ""
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.stdin.end(options.input ?? "");
    child.on("close", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

function runNodeScript(script: string, cwd: string, configDir: string, stateDir: string, options: RunCliOptions = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: undefined,
        AGENT_BRIDGE_CONFIG_DIR: configDir,
        AGENT_BRIDGE_STATE_DIR: stateDir,
        ...options.extraEnv,
        PATH: ""
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.stdin.end(options.input ?? "");
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

async function writeConfig(configDir: string, port: number, agents: unknown[]): Promise<void> {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    port,
    uncertainBehavior: "continue",
    agents,
    routes: []
  }, null, 2)}\n`, "utf8");
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("Unable to allocate a free port"));
      });
    });
  });
}
