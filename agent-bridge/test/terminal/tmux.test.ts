import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  const previousShell = process.env.SHELL;
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

    const fakeTtySensitiveConsumer = join(dir, "fake-tty-sensitive-consumer.mjs");
    await writeFile(fakeTtySensitiveConsumer, [
      "if (process.stdin.isTTY) {",
      "  console.error('stdin was a tty');",
      "  process.exit(9);",
      "}",
      "let input = '';",
      "process.stdin.on('data', (chunk) => input += chunk);",
      "process.stdin.on('end', () => console.log(JSON.stringify({ verdict: 'pass', summary: input.trim(), findings: [], suggestedPrompt: '' })));"
    ].join("\n"), "utf8");
    const ttySensitiveResult = await session.runner.run(process.execPath, [fakeTtySensitiveConsumer], "file-backed stdin", {
      cwd: dir,
      timeout: 15_000,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(ttySensitiveResult.stdout, /file-backed stdin/);

    const fakeShell = join(dir, "fake-user-shell");
    await writeFile(fakeShell, [
      "#!/bin/sh",
      "if [ \"$1\" = \"-ilc\" ]; then",
      "  export AGENT_BRIDGE_TEST_SHELL_ENV=from-user-shell",
      "  exec /bin/sh -c \"$2\"",
      "fi",
      "exec /bin/sh \"$@\""
    ].join("\n"), "utf8");
    await chmod(fakeShell, 0o755);
    const fakeShellEnvConsumer = join(dir, "fake-shell-env-consumer.mjs");
    await writeFile(fakeShellEnvConsumer, [
      "const summary = process.env.AGENT_BRIDGE_TEST_SHELL_ENV ?? 'missing';",
      "console.log(JSON.stringify({ verdict: 'pass', summary, findings: [], suggestedPrompt: '' }));"
    ].join("\n"), "utf8");
    process.env.SHELL = fakeShell;
    const shellEnvResult = await session.runner.run(process.execPath, [fakeShellEnvConsumer], "", {
      cwd: dir,
      timeout: 15_000,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(shellEnvResult.stdout, /from-user-shell/);
    if (previousShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = previousShell;
    }

    await assert.rejects(session.runner.run(process.execPath, ["-e", "process.exit(7)"], "", {
      cwd: dir,
      timeout: 15_000,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    }), /Agent command exited with code 7/);

    const afterFailureResult = await session.runner.run(process.execPath, [fakeConsumer], "after failure", {
      cwd: dir,
      timeout: 15_000,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(afterFailureResult.stdout, /after failure/);

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

    const fakeSlowReadyConsumer = join(dir, "fake-slow-ready-consumer.mjs");
    await writeFile(fakeSlowReadyConsumer, [
      "process.stdin.setEncoding('utf8');",
      "let ready = false;",
      "console.log('booting');",
      "setTimeout(() => { ready = true; console.log('AIDEN_READY'); }, 600);",
      "process.stdin.on('data', (input) => console.log(JSON.stringify({ verdict: 'pass', summary: `${ready ? 'ready' : 'early'} ${input.trim()}`, findings: [], suggestedPrompt: '' })));",
      "setInterval(() => undefined, 1000);"
    ].join("\n"), "utf8");

    const readyResult = await session.runner.runTty?.(process.execPath, [fakeSlowReadyConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 10,
      terminalInput: "after ready",
      readyPattern: /AIDEN_READY/,
      readyTimeoutMs: 5_000,
      readyQuietMs: 100,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(readyResult?.stdout ?? "", /ready after ready/);

    const fakeAidenBootConsumer = join(dir, "fake-aiden-boot-consumer.mjs");
    await writeFile(fakeAidenBootConsumer, [
      "process.stdin.setEncoding('utf8');",
      "console.log('Check user login status...');",
      "setTimeout(() => console.log('agent full mode (shift + tab to toggle)'), 500);",
      "process.stdin.on('data', (input) => console.log(JSON.stringify({ verdict: 'pass', summary: input.includes('after aiden ready') ? 'submitted after ready' : 'wrong input', findings: [], suggestedPrompt: '' })));",
      "setInterval(() => undefined, 1000);"
    ].join("\n"), "utf8");

    const aidenReadyResult = await session.runner.runTty?.(process.execPath, [fakeAidenBootConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 10,
      terminalInputMode: "literal",
      terminalInput: "after aiden ready",
      readyPattern: /agent\s+full mode[\s\S]*toggle/i,
      readyTimeoutMs: 5_000,
      readyQuietMs: 100,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(aidenReadyResult?.stdout ?? "", /submitted after ready/);

    const fakeBusyReadyConsumer = join(dir, "fake-busy-ready-consumer.mjs");
    await writeFile(fakeBusyReadyConsumer, [
      "process.stdin.setEncoding('utf8');",
      "let ready = false;",
      "console.log('agent full mode (shift + tab to toggle)');",
      "console.log('Working… (1s · esc to interrupt)');",
      "setTimeout(() => { ready = true; console.log('agent full mode (shift + tab to toggle)'); }, 900);",
      "process.stdin.on('data', (input) => console.log(JSON.stringify({ verdict: 'pass', summary: `${ready ? 'idle' : 'busy'} ${input.trim()}`, findings: [], suggestedPrompt: '' })));",
      "setInterval(() => undefined, 1000);"
    ].join("\n"), "utf8");

    const busyReadyResult = await session.runner.runTty?.(process.execPath, [fakeBusyReadyConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 10,
      terminalInputMode: "literal",
      terminalInput: "after busy",
      readyPattern: /agent\s+full mode[\s\S]*toggle/i,
      busyPattern: /\b(?:Working|Processing)\b|esc to interrupt/i,
      readyTimeoutMs: 5_000,
      readyQuietMs: 100,
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(busyReadyResult?.stdout ?? "", /idle after busy/);
    const finalLog = await readTerminalLog("tmux-run-1", "codex");
    assert.match(finalLog, /idle after busy/);
  } finally {
    if (previousShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = previousShell;
    }
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    if (tmuxSession) {
      spawnSync("tmux", ["kill-session", "-t", tmuxSession], { stdio: "ignore" });
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("tmux worker reuses the same interactive CLI session for the same worker id", {
  skip: tmuxSkipReason ?? undefined
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-tmux-worker-"));
  const stateDir = join(dir, "state");
  let tmuxSession: string | undefined;
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?state=${Date.now()}`;
    const tmuxUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "tmux.ts")).href}?state=${Date.now()}`;
    const { createTerminalSession, readTerminalLog, workerTerminalLogPath } = await import(logsUrl);
    const { attachTmuxRunner } = await import(tmuxUrl);
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: process.execPath,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const fakeInteractiveConsumer = join(dir, "fake-worker-consumer.mjs");
    await writeFile(fakeInteractiveConsumer, [
      "process.stdin.setEncoding('utf8');",
      "let count = 0;",
      "process.stdin.on('data', (input) => {",
      "  count += 1;",
      "  console.log(JSON.stringify({ verdict: 'pass', summary: `count=${count} ${input.trim()}`, findings: [], suggestedPrompt: '' }));",
      "});",
      "setInterval(() => undefined, 1000);"
    ].join("\n"), "utf8");

    const first = createTerminalSession("run-1", agent, dir, undefined, {
      workerId: "worker-1",
      workerKey: "key"
    });
    attachTmuxRunner(first, { runId: "run-1", agent, cwd: dir });
    tmuxSession = first.tmuxSession;
    const firstResult = await first.runner?.runTty?.(process.execPath, [fakeInteractiveConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 100,
      terminalInput: "first",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(firstResult?.stdout ?? "", /count=1 first/);

    const second = createTerminalSession("run-2", agent, dir, undefined, {
      workerId: "worker-1",
      workerKey: "key"
    });
    attachTmuxRunner(second, { runId: "run-2", agent, cwd: dir });
    assert.equal(second.tmuxSession, tmuxSession);
    const secondResult = await second.runner?.runTty?.(process.execPath, [fakeInteractiveConsumer], {
      cwd: dir,
      timeout: 15_000,
      inputDelayMs: 100,
      terminalInput: "second",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(secondResult?.stdout ?? "", /count=2 second/);

    const firstRunLog = await readTerminalLog("run-1", "aiden");
    const secondRunLog = await readTerminalLog("run-2", "aiden");
    const workerLog = await readFile(workerTerminalLogPath("worker-1", "aiden"), "utf8");
    assert.match(firstRunLog, /> first/);
    assert.match(firstRunLog, /count=1 first/);
    assert.doesNotMatch(firstRunLog, /count=2 second/);
    assert.match(secondRunLog, /> second/);
    assert.match(secondRunLog, /count=2 second/);
    assert.match(workerLog, /count=1 first/);
    assert.match(workerLog, /count=2 second/);
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    if (tmuxSession) {
      spawnSync("tmux", ["kill-session", "-t", tmuxSession], { stdio: "ignore" });
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("tmux runner pastes multiline interactive input through tmux buffer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-fake-tmux-"));
  const stateDir = join(dir, "state");
  const fakeTmux = join(dir, "fake-tmux.mjs");
  const fakeState = join(dir, "fake-tmux-state.json");
  const fakeCalls = join(dir, "fake-tmux-calls.jsonl");
  const previousTmux = process.env.AGENT_BRIDGE_TMUX;
  try {
    await mkdir(stateDir);
    await writeFile(fakeTmux, `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const statePath = process.env.FAKE_TMUX_STATE;
const callsPath = process.env.FAKE_TMUX_CALLS;
const logPath = process.env.FAKE_TMUX_LIVE_LOG;
let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;

function readState() {
  if (!statePath || !existsSync(statePath)) return {};
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function writeState(state) {
  if (statePath) writeFileSync(statePath, JSON.stringify(state));
}

if (callsPath) appendFileSync(callsPath, JSON.stringify({ args, stdin }) + "\\n");
const state = readState();
const command = args[0];

if (command === "has-session") {
  process.exit(state.exists ? 0 : 1);
}
if (command === "new-session") {
  state.exists = true;
  writeState(state);
  process.exit(0);
}
if (command === "display-message") {
  process.stdout.write(args.includes("#{pane_pid}") ? "4321\\n" : "0\\n");
  process.exit(0);
}
if (command === "pipe-pane") {
  process.exit(0);
}
if (command === "load-buffer") {
  state.buffer = stdin;
  writeState(state);
  process.exit(0);
}
if (command === "paste-buffer") {
  state.pasteArgs = args;
  state.pasteCount = (state.pasteCount ?? 0) + 1;
  writeState(state);
  process.exit(0);
}
if (command === "send-keys") {
  if (args.includes("-l")) {
    state.literalText = [...(state.literalText ?? []), args.at(-1)];
  }
  if (args.includes("Enter") && logPath) {
    appendFileSync(logPath, "\\n" + JSON.stringify({ verdict: "pass", summary: process.env.FAKE_TMUX_RESULT_SUMMARY ?? "fake tmux result", findings: [], suggestedPrompt: "" }) + "\\n");
  }
  writeState(state);
  process.exit(0);
}
if (command === "kill-session") {
  state.exists = false;
  writeState(state);
  process.exit(0);
}
process.exit(0);
`, "utf8");
    await chmod(fakeTmux, 0o755);
    process.env.AGENT_BRIDGE_TMUX = fakeTmux;
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    process.env.FAKE_TMUX_STATE = fakeState;
    process.env.FAKE_TMUX_CALLS = fakeCalls;

    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?state=${Date.now()}`;
    const tmuxUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "tmux.ts")).href}?state=${Date.now()}`;
    const { createTerminalSession, workerTerminalLogPath } = await import(logsUrl);
    const { attachTmuxRunner } = await import(tmuxUrl);
    const agent: Agent = {
      id: "aiden",
      kind: "aiden",
      label: "Aiden",
      command: process.execPath,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const session = createTerminalSession("fake-tmux-run", agent, dir);
    process.env.FAKE_TMUX_LIVE_LOG = session.logPath;
    attachTmuxRunner(session, { runId: "fake-tmux-run", agent, cwd: dir });

    const result = await session.runner?.runTty?.(process.execPath, ["fake-consumer.mjs"], {
      cwd: dir,
      timeout: 5_000,
      inputDelayMs: 1,
      terminalInput: "<user_message>\nline one\nline two\n</user_message>",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });

    assert.match(result?.stdout ?? "", /fake tmux result/);
    const calls = (await readFile(fakeCalls, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { args: string[]; stdin: string });
    assert.ok(calls.some((call) => call.args[0] === "paste-buffer" && call.args.includes("-p")));
    assert.equal(calls.some((call) => call.args[0] === "send-keys" && call.args.includes("-l")), false);
    assert.ok(calls.some((call) => call.args[0] === "send-keys" && call.args.includes("Enter")));

    const literalResult = await session.runner?.runTty?.(process.execPath, ["fake-consumer.mjs"], {
      cwd: dir,
      timeout: 5_000,
      inputDelayMs: 1,
      terminalInputMode: "literal",
      terminalInput: "<user_message>\nliteral line\n</user_message>",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(literalResult?.stdout ?? "", /fake tmux result/);
    const literalCalls = (await readFile(fakeCalls, "utf8"))
      .trim()
      .split("\n")
      .slice(calls.length)
      .map((line) => JSON.parse(line) as { args: string[]; stdin: string });
    assert.ok(literalCalls.some((call) => call.args[0] === "send-keys" && call.args.includes("-l")));
    assert.equal(literalCalls.some((call) => call.args[0] === "paste-buffer"), false);

    const workerLog = workerTerminalLogPath("worker-byte-offset", "aiden");
    await mkdir(dirname(workerLog), { recursive: true });
    await writeFile(workerLog, [
      "历史输出：你好",
      "✦ {\"verdict\":\"pass\",\"summary\":\"stale tmux result\",\"findings\":[],\"suggestedPrompt\":\"\"}"
    ].join("\n"), "utf8");
    await writeFile(fakeState, JSON.stringify({ exists: true }), "utf8");
    process.env.FAKE_TMUX_LIVE_LOG = workerLog;
    process.env.FAKE_TMUX_RESULT_SUMMARY = "fresh tmux result";
    const workerSession = createTerminalSession("fake-worker-byte-offset-run", agent, dir, undefined, {
      workerId: "worker-byte-offset",
      workerKey: "key"
    });
    attachTmuxRunner(workerSession, { runId: "fake-worker-byte-offset-run", agent, cwd: dir });
    const workerResult = await workerSession.runner?.runTty?.(process.execPath, ["fake-consumer.mjs"], {
      cwd: dir,
      timeout: 5_000,
      inputDelayMs: 1,
      terminalInput: "fresh input",
      env: {
        ...process.env,
        AGENT_BRIDGE_BYPASS: "1"
      }
    });
    assert.match(workerResult?.stdout ?? "", /fresh tmux result/);
    assert.doesNotMatch(workerResult?.stdout ?? "", /stale tmux result/);
  } finally {
    if (previousTmux === undefined) {
      delete process.env.AGENT_BRIDGE_TMUX;
    } else {
      process.env.AGENT_BRIDGE_TMUX = previousTmux;
    }
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    delete process.env.FAKE_TMUX_STATE;
    delete process.env.FAKE_TMUX_CALLS;
    delete process.env.FAKE_TMUX_LIVE_LOG;
    delete process.env.FAKE_TMUX_RESULT_SUMMARY;
    await rm(dir, { recursive: true, force: true });
  }
});

test("tmux command collection tolerates fast stdin close", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-fast-tmux-"));
  const fakeTmux = join(dir, "fake-fast-tmux.mjs");
  const previousTmux = process.env.AGENT_BRIDGE_TMUX;
  try {
    await writeFile(fakeTmux, `#!/usr/bin/env node
const command = process.argv[2];
if (command === "has-session" || command === "load-buffer" || command === "paste-buffer") {
  process.exit(0);
}
process.exit(0);
`, "utf8");
    await chmod(fakeTmux, 0o755);
    process.env.AGENT_BRIDGE_TMUX = fakeTmux;

    const tmuxUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "tmux.ts")).href}?state=${Date.now()}-fast-close`;
    const { sendTerminalInput } = await import(tmuxUrl);

    await assert.doesNotReject(sendTerminalInput("fast-close", "x".repeat(5 * 1024 * 1024)));
  } finally {
    if (previousTmux === undefined) {
      delete process.env.AGENT_BRIDGE_TMUX;
    } else {
      process.env.AGENT_BRIDGE_TMUX = previousTmux;
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
