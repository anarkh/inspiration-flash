import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import type { Agent } from "../../src/core/types.ts";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("terminal capture writes a replayable ansi log", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-"));
  const stateDir = join(dir, "state");
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?state=${Date.now()}`;
    const { createTerminalSession, readTerminalLog } = await import(logsUrl);
    const agent: Agent = {
      id: "codex",
      kind: "codex",
      label: "Codex",
      command: "codex",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const session = createTerminalSession("run-1", agent, dir);
    session.capture.onStart?.({ pid: 123, command: "codex", args: ["exec", "ok"], cwd: dir });
    session.capture.onStdout?.(Buffer.from("hello\n"));
    session.capture.onStderr?.(Buffer.from("warn\n"));
    session.capture.onClose?.(0);

    await session.flush();
    const log = await readTerminalLog("run-1", "codex");
    assert.match(log, /Agent Bridge terminal/);
    assert.match(log, /pid: 123/);
    assert.match(log, /hello/);
    assert.match(log, /warn/);
    assert.match(log, /process exited with code 0/);
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("terminal capture mirrors complete runs into worker history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-worker-"));
  const stateDir = join(dir, "state");
  try {
    await mkdir(stateDir);
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?worker=${Date.now()}`;
    const { createTerminalSession, workerTerminalLogPath } = await import(logsUrl);
    const agent: Agent = {
      id: "claude",
      kind: "claude",
      label: "Claude Code",
      command: "claude",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    for (const [runId, output] of [["capture-run-1", "first capture"], ["capture-run-2", "second capture"]]) {
      const session = createTerminalSession(runId, agent, dir, undefined, {
        workerId: "capture-worker",
        workerKey: "key"
      });
      session.capture.onStart?.({ pid: 123, command: "claude", args: ["-p"], cwd: dir });
      session.capture.onStdout?.(Buffer.from(`${output}\n`));
      session.capture.onClose?.(0);
      await session.flush();
    }

    const workerLog = await readFile(workerTerminalLogPath("capture-worker", "claude"), "utf8");
    assert.match(workerLog, /capture-run-1/);
    assert.match(workerLog, /capture-run-2/);
    assert.match(workerLog, /first capture/);
    assert.match(workerLog, /second capture/);
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("terminal log tails can be released and reacquired without replaying the whole file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-tail-"));
  const stateDir = join(dir, "state");
  const logPath = join(dir, "worker.log");
  try {
    await mkdir(stateDir);
    await writeFile(logPath, "existing\n", "utf8");
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?tail=${Date.now()}`;
    const { tailTerminalLog } = await import(logsUrl);
    const events: string[] = [];
    const release = tailTerminalLog(logPath, Buffer.byteLength("existing\n"), (data: string) => {
      events.push(data);
    });

    await appendFile(logPath, "first\n", "utf8");
    await delay(350);
    assert.match(events.join(""), /first/);
    assert.doesNotMatch(events.join(""), /existing/);
    release();

    const afterRelease = events.length;
    await appendFile(logPath, "released\n", "utf8");
    await delay(350);
    assert.equal(events.length, afterRelease);

    const resumed: string[] = [];
    const resumeOffset = (await readFile(logPath)).length;
    const releaseResumed = tailTerminalLog(logPath, resumeOffset, (data: string) => {
      resumed.push(data);
    });
    await appendFile(logPath, "second\n", "utf8");
    await delay(350);
    assert.match(resumed.join(""), /second/);
    assert.doesNotMatch(resumed.join(""), /released/);
    releaseResumed();
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("terminal snapshots stream complete history in bounded chunks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-snapshot-"));
  const stateDir = join(dir, "state");
  const logPath = join(dir, "large-worker.log");
  const content = `${"x".repeat((256 * 1024) - 1)}你\n${"y".repeat(340_000)}\nend-marker`;
  try {
    await mkdir(stateDir);
    await writeFile(logPath, content, "utf8");
    process.env.AGENT_BRIDGE_STATE_DIR = stateDir;
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?snapshot=${Date.now()}`;
    const { streamTerminalLogSnapshot } = await import(logsUrl);
    const chunks: Buffer[] = [];
    const offset = await streamTerminalLogSnapshot(logPath, (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    });

    assert.ok(chunks.length > 1);
    assert.equal(Buffer.concat(chunks).toString("utf8"), content);
    const decoder = new StringDecoder("utf8");
    assert.equal(chunks.map((chunk) => decoder.write(chunk)).join("") + decoder.end(), content);
    assert.equal(offset, Buffer.byteLength(content));
  } finally {
    delete process.env.AGENT_BRIDGE_STATE_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("terminal tails preserve utf8 characters split across appends", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-terminal-utf8-tail-"));
  const logPath = join(dir, "worker.log");
  try {
    await writeFile(logPath, "", "utf8");
    const logsUrl = `${pathToFileURL(join(repoRoot, "src", "terminal", "logs.ts")).href}?utf8=${Date.now()}`;
    const { tailTerminalLog } = await import(logsUrl);
    const events: string[] = [];
    const release = tailTerminalLog(logPath, 0, (data: string) => events.push(data));
    const encoded = Buffer.from("你\n", "utf8");

    await appendFile(logPath, encoded.subarray(0, 2));
    await delay(300);
    assert.equal(events.join(""), "");
    await appendFile(logPath, encoded.subarray(2));
    await delay(300);
    assert.equal(events.join(""), "你\n");
    release();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
