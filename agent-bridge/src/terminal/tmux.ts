import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Agent } from "../core/types.ts";
import { BYPASS_ENV } from "../core/constants.ts";
import { detectKnownAgentError, firstKnownAgentErrorLine, type KnownAgentErrorKind } from "../core/agent-errors.ts";
import { hasBridgeResultJson } from "../bridge/result-parser.ts";
import type { SpawnInputOptions, SpawnInputResult, SpawnProcessInfo, TtyRunOptions } from "../agents/shared/process.ts";
import {
  appendTerminalLog,
  ensureTerminalLogTail,
  formatCommandLine,
  publishTerminalEvent,
  shellQuote,
  type TerminalSession,
  writeTerminalLog
} from "./logs.ts";

interface AttachTmuxOptions {
  runId: string;
  agent: Agent;
  cwd: string;
  onStart?: (info: SpawnProcessInfo, terminal: TerminalSession) => void;
}

const TMUX_BACKEND_ENV = "AGENT_BRIDGE_TERMINAL_BACKEND";
const TMUX_BIN_ENV = "AGENT_BRIDGE_TMUX";
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 36;
let cachedTmux: string | null | undefined;

class KnownFatalOutputError extends Error {
  readonly kind: KnownAgentErrorKind;
  readonly line: string;

  constructor(kind: KnownAgentErrorKind, line: string) {
    super(`Agent command produced ${kind} output: ${line}`);
    this.kind = kind;
    this.line = line;
  }
}

export function attachTmuxRunner(session: TerminalSession, options: AttachTmuxOptions): void {
  const tmux = tmuxBinary();
  if (!tmux) {
    return;
  }
  session.backend = "tmux";
  session.tmuxSession = tmuxSessionName(session.terminalId);
  session.runner = {
    run: (command, args, input, runOptions) => runInTmux(tmux, session, options, command, args, input, runOptions),
    runTty: (command, args, runOptions) => runInteractiveInTmux(tmux, session, options, command, args, runOptions)
  };
}

export async function sendTerminalInput(terminalId: string, data: string): Promise<boolean> {
  const tmux = tmuxBinary();
  if (!tmux || data.length === 0) {
    return false;
  }
  const sessionName = tmuxSessionName(terminalId);
  if (!await hasSession(tmux, sessionName)) {
    return false;
  }
  if (data === "\x03") {
    await execTmux(tmux, ["send-keys", "-t", sessionName, "C-c"]);
    return true;
  }
  if (data === "\x04") {
    await execTmux(tmux, ["send-keys", "-t", sessionName, "C-d"]);
    return true;
  }
  const bufferName = `agent-bridge-${createHash("sha1").update(`${terminalId}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 12)}`;
  await execTmux(tmux, ["load-buffer", "-b", bufferName, "-"], data);
  await execTmux(tmux, ["paste-buffer", "-d", "-b", bufferName, "-t", sessionName]);
  return true;
}

export async function resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
  const tmux = tmuxBinary();
  if (!tmux) {
    return false;
  }
  const sessionName = tmuxSessionName(terminalId);
  if (!await hasSession(tmux, sessionName)) {
    return false;
  }
  await execTmux(tmux, [
    "resize-window",
    "-t",
    sessionName,
    "-x",
    String(Math.max(40, Math.floor(cols))),
    "-y",
    String(Math.max(12, Math.floor(rows)))
  ]);
  return true;
}

export function tmuxSessionName(terminalId: string): string {
  const hash = createHash("sha1").update(terminalId).digest("hex").slice(0, 12);
  const readable = terminalId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  return `agent-bridge-${readable}-${hash}`;
}

function tmuxBinary(): string | null {
  const mode = process.env[TMUX_BACKEND_ENV];
  if (mode === "capture") {
    return null;
  }
  if (cachedTmux !== undefined) {
    return cachedTmux;
  }
  const configured = process.env[TMUX_BIN_ENV];
  if (configured) {
    cachedTmux = configured;
    return cachedTmux;
  }
  const result = spawnSync("tmux", ["-V"], { stdio: "ignore" });
  cachedTmux = result.status === 0 ? "tmux" : null;
  return cachedTmux;
}

async function runInTmux(
  tmux: string,
  session: TerminalSession,
  attachOptions: AttachTmuxOptions,
  command: string,
  args: string[],
  input: string,
  runOptions: SpawnInputOptions
): Promise<SpawnInputResult> {
  const sessionName = session.tmuxSession ?? tmuxSessionName(session.terminalId);
  const workDir = dirname(session.logPath);
  await mkdir(workDir, { recursive: true });

  const exitPath = join(workDir, "exit-code.txt");
  const donePath = join(workDir, "done");
  await Promise.all([
    rm(exitPath, { force: true }),
    rm(donePath, { force: true })
  ]);

  const commandLine = formatCommandLine(command, args);
  const panePid = await startTmuxCommand(
    tmux,
    session,
    sessionName,
    attachOptions,
    runOptions.cwd,
    commandLine,
    shellCommandWithExitMarker(command, args, runOptions.env, exitPath, donePath)
  );
  attachOptions.onStart?.({
    pid: panePid,
    command,
    args,
    cwd: runOptions.cwd
  }, session);

  if (input.length > 0) {
    await delay(250);
    await pasteIntoTmux(tmux, sessionName, input);
    if (!input.endsWith("\n") && !input.endsWith("\r")) {
      await execTmux(tmux, ["send-keys", "-t", sessionName, "C-m"]);
    }
    await delay(50);
    await execTmux(tmux, ["send-keys", "-t", sessionName, "C-d"]);
  }

  try {
    await waitForCommandDone(donePath, session.logPath, runOptions.timeout);
  } catch (error) {
    await execTmux(tmux, ["send-keys", "-t", sessionName, "C-c"]).catch(() => undefined);
    const output = await readFile(session.logPath, "utf8").catch(() => "");
    const footer = error instanceof KnownFatalOutputError
      ? `\r\n\x1b[90m# process interrupted after ${error.kind} output\x1b[0m\r\n`
      : `\r\n\x1b[90m# process timed out after ${runOptions.timeout} ms\x1b[0m\r\n`;
    await appendTerminalLog(session.logPath, footer);
    publishTerminalEvent(session.terminalId, { type: "close", data: footer, code: null });
    const message = error instanceof Error ? error.message : String(error);
    const timeout = new Error(`${message}\n\nTerminal tail:\n${output.slice(-2000)}`) as Error & {
      stdout?: string;
      stderr?: string;
      code?: number | null;
    };
    timeout.stdout = output;
    timeout.stderr = "";
    timeout.code = null;
    throw timeout;
  }

  await delay(200);
  const output = await readFile(session.logPath, "utf8").catch(() => "");
  const code = Number.parseInt((await readFile(exitPath, "utf8").catch(() => "1")).trim(), 10);
  const exitCode = Number.isInteger(code) ? code : 1;
  const footer = `\r\n\x1b[90m# process exited with code ${exitCode}\x1b[0m\r\n`;
  await appendTerminalLog(session.logPath, footer);
  publishTerminalEvent(session.terminalId, { type: "close", data: footer, code: exitCode });
  const result = {
    stdout: output,
    stderr: ""
  };
  if (exitCode === 0) {
    return result;
  }
  const error = new Error(`Agent command exited with code ${exitCode}`) as Error & {
    stdout?: string;
    stderr?: string;
    code?: number | null;
  };
  error.stdout = result.stdout;
  error.stderr = result.stderr;
  error.code = exitCode;
  throw error;
}

async function runInteractiveInTmux(
  tmux: string,
  session: TerminalSession,
  attachOptions: AttachTmuxOptions,
  command: string,
  args: string[],
  runOptions: TtyRunOptions
): Promise<SpawnInputResult> {
  const sessionName = session.tmuxSession ?? tmuxSessionName(session.terminalId);
  const workDir = dirname(session.logPath);
  await mkdir(workDir, { recursive: true });

  const commandLine = formatCommandLine(command, args);
  const panePid = await startTmuxCommand(
    tmux,
    session,
    sessionName,
    attachOptions,
    runOptions.cwd,
    commandLine,
    shellQuote([
      ...envCommandPrefix(runOptions.env),
      command,
      ...args
    ])
  );
  attachOptions.onStart?.({
    pid: panePid,
    command,
    args,
    cwd: runOptions.cwd
  }, session);

  await delay(runOptions.inputDelayMs ?? 1500);
  const outputOffset = await stat(session.logPath).then((item) => item.size, () => 0);
  await pasteIntoTmux(tmux, sessionName, runOptions.terminalInput);
  await execTmux(tmux, ["send-keys", "-t", sessionName, "C-m"]);

  try {
    const stdout = await waitForInteractiveResult(session.logPath, outputOffset, runOptions.timeout);
    const footer = "\r\n\x1b[90m# bridge result detected; terminal left open\x1b[0m\r\n";
    await appendTerminalLog(session.logPath, footer);
    publishTerminalEvent(session.terminalId, { type: "stdout", data: footer });
    return {
      stdout,
      stderr: ""
    };
  } catch (error) {
    const output = await readFile(session.logPath, "utf8").catch(() => "");
    const footer = error instanceof KnownFatalOutputError
      ? `\r\n\x1b[90m# interactive terminal observed ${error.kind} output\x1b[0m\r\n`
      : `\r\n\x1b[90m# interactive terminal timed out after ${runOptions.timeout} ms\x1b[0m\r\n`;
    await appendTerminalLog(session.logPath, footer);
    publishTerminalEvent(session.terminalId, { type: "stdout", data: footer });
    const message = error instanceof Error ? error.message : String(error);
    const terminalError = new Error(`${message}\n\nTerminal tail:\n${output.slice(-2000)}`) as Error & {
      stdout?: string;
      stderr?: string;
      code?: number | null;
    };
    terminalError.stdout = output;
    terminalError.stderr = "";
    terminalError.code = null;
    throw terminalError;
  }
}

async function startTmuxCommand(
  tmux: string,
  session: TerminalSession,
  sessionName: string,
  attachOptions: AttachTmuxOptions,
  cwd: string,
  commandLine: string,
  shellCommand: string
): Promise<number> {
  if (await hasSession(tmux, sessionName)) {
    await execTmux(tmux, ["kill-session", "-t", sessionName]).catch(() => undefined);
  }
  await execTmux(tmux, [
    "new-session",
    "-d",
    "-s",
    sessionName,
    "-c",
    cwd,
    "-x",
    String(DEFAULT_COLS),
    "-y",
    String(DEFAULT_ROWS),
    shellCommand
  ]);

  const panePid = await paneProcessId(tmux, sessionName);
  const header = [
    `\x1b[90m# Agent Bridge tmux terminal\x1b[0m`,
    `\x1b[90m# run: ${attachOptions.runId}\x1b[0m`,
    `\x1b[90m# agent: ${attachOptions.agent.label}\x1b[0m`,
    `\x1b[90m# cwd: ${attachOptions.cwd}\x1b[0m`,
    `\x1b[90m# tmux: ${sessionName}\x1b[0m`,
    `\x1b[90m# pane pid: ${panePid}\x1b[0m`,
    `\x1b[90m$ ${commandLine}\x1b[0m`,
    ""
  ].join("\r\n");
  await writeTerminalLog(session.logPath, header);
  await execTmux(tmux, ["pipe-pane", "-o", "-t", sessionName, `cat >> ${shellQuote([session.logPath])}`]);
  ensureTerminalLogTail(session.terminalId, session.logPath, true);
  publishTerminalEvent(session.terminalId, { type: "start", data: header, pid: panePid });
  return panePid;
}

function shellCommandWithExitMarker(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  exitPath: string,
  donePath: string
): string {
  const executable = shellQuote([
    ...envCommandPrefix(env),
    command,
    ...args
  ]);
  return [
    executable,
    "agent_bridge_code=$?",
    "printf '\\r\\n\\033[90m# agent-bridge command exit code %s\\033[0m\\r\\n' \"$agent_bridge_code\"",
    `printf '%s\\n' "$agent_bridge_code" > ${shellQuote([exitPath])}`,
    `touch ${shellQuote([donePath])}`,
    `exec ${shellQuote([env.SHELL ?? process.env.SHELL ?? "/bin/sh"])}`
  ].join("; ");
}

function envCommandPrefix(env: NodeJS.ProcessEnv): string[] {
  const selected = [
    "HOME",
    "PATH",
    "SHELL",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "XDG_CONFIG_HOME",
    "XDG_STATE_HOME",
    BYPASS_ENV
  ];
  const values = selected
    .map((key) => [key, env[key]] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].length > 0);
  return values.length === 0
    ? []
    : ["env", ...values.map(([key, value]) => `${key}=${value}`)];
}

async function waitForCommandDone(donePath: string, logPath: string, timeout: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await stat(donePath).then(() => true, () => false)) {
      return;
    }
    const output = await readFile(logPath, "utf8").catch(() => "");
    const knownError = detectKnownAgentError(output);
    if (knownError && !hasBridgeResultJson(output)) {
      const line = firstKnownAgentErrorLine(output, knownError) ?? knownError.title("Agent");
      throw new KnownFatalOutputError(knownError.kind, line);
    }
    await delay(200);
  }
  throw new Error(`Agent command timed out after ${timeout} ms`);
}

async function waitForInteractiveResult(logPath: string, outputOffset: number, timeout: number): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const output = await readFile(logPath, "utf8").catch(() => "");
    const relevantOutput = output.slice(outputOffset);
    if (hasBridgeResultJson(relevantOutput)) {
      return relevantOutput;
    }
    const knownError = detectKnownAgentError(relevantOutput);
    if (knownError) {
      const line = firstKnownAgentErrorLine(relevantOutput, knownError) ?? knownError.title("Agent");
      throw new KnownFatalOutputError(knownError.kind, line);
    }
    await delay(300);
  }
  throw new Error(`Interactive agent command timed out after ${timeout} ms`);
}

async function pasteIntoTmux(tmux: string, sessionName: string, text: string): Promise<void> {
  const bufferName = `agent-bridge-${createHash("sha1").update(`${sessionName}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 12)}`;
  await execTmux(tmux, ["load-buffer", "-b", bufferName, "-"], text);
  await execTmux(tmux, ["paste-buffer", "-d", "-b", bufferName, "-t", sessionName]);
}

async function paneProcessId(tmux: string, sessionName: string): Promise<number> {
  const output = await execTmux(tmux, ["display-message", "-p", "-t", sessionName, "#{pane_pid}"]);
  const pid = Number.parseInt(output.trim(), 10);
  return Number.isInteger(pid) ? pid : 0;
}

async function hasSession(tmux: string, sessionName: string): Promise<boolean> {
  const result = await execTmuxStatus(tmux, ["has-session", "-t", sessionName]);
  return result === 0;
}

async function execTmux(tmux: string, args: string[], input?: string): Promise<string> {
  const result = await spawnCollect(tmux, args, input);
  if (result.code === 0) {
    return result.stdout;
  }
  throw new Error(`tmux ${args[0] ?? ""} failed: ${result.stderr || result.stdout}`.trim());
}

async function execTmuxStatus(tmux: string, args: string[]): Promise<number> {
  const result = await spawnCollect(tmux, args);
  return result.code ?? 1;
}

function spawnCollect(command: string, args: string[], input?: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(input ?? "");
  });
}
