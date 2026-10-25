import { EventEmitter } from "node:events";
import { appendFile, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { TERMINAL_LOG_DIR } from "../core/constants.ts";
import type { Agent } from "../core/types.ts";
import type { AgentCommandRunner, SpawnCapture, SpawnProcessInfo } from "../agents/shared/process.ts";

export interface TerminalSession {
  terminalId: string;
  logPath: string;
  workerLogPath?: string;
  backend: "capture" | "tmux";
  tmuxSession?: string;
  workerId?: string;
  workerKey?: string;
  workerContextDir?: string;
  capture: SpawnCapture;
  runner?: AgentCommandRunner;
  flush(): Promise<void>;
}

export interface TerminalSessionOptions {
  workerId?: string;
  workerKey?: string;
}

export interface TerminalLogEvent {
  type: "start" | "stdout" | "stderr" | "close";
  data?: string;
  pid?: number;
  code?: number | null;
}

const streams = new Map<string, EventEmitter>();
const logWriteQueues = new Map<string, Promise<void>>();
const TAIL_POLL_MS = 200;
const LOG_READ_CHUNK_BYTES = 256 * 1024;

interface TerminalTail {
  path: string;
  offset: number;
  reading: boolean;
  active: boolean;
  decoder: StringDecoder;
  timer: NodeJS.Timeout;
}

export function createTerminalSession(
  runId: string,
  agent: Agent,
  cwd: string,
  onStart?: (info: SpawnProcessInfo, terminal: TerminalSession) => void,
  options: TerminalSessionOptions = {}
): TerminalSession {
  const terminalId = options.workerId
    ? terminalWorkerKey(options.workerId, agent.kind)
    : terminalKey(runId, agent.kind);
  const logPath = terminalLogPath(runId, agent.kind);
  const workerLogPath = options.workerId
    ? workerTerminalLogPath(options.workerId, agent.kind)
    : undefined;
  const workerContextDir = options.workerId
    ? terminalWorkerContextDir(options.workerId)
    : undefined;
  let queue = initializeTerminalPaths(logPath, workerLogPath, workerContextDir);
  const session: TerminalSession = {
    terminalId,
    logPath,
    workerLogPath,
    backend: "capture",
    workerId: options.workerId,
    workerKey: options.workerKey,
    workerContextDir,
    flush: () => queue,
    capture: {
      onStart(info) {
        const commandLine = formatCommandLine(info.command, info.args);
        const header = [
          `\x1b[90m# Agent Bridge terminal\x1b[0m`,
          `\x1b[90m# run: ${runId}\x1b[0m`,
          ...(options.workerId ? [`\x1b[90m# worker: ${options.workerId}\x1b[0m`] : []),
          `\x1b[90m# agent: ${agent.label}\x1b[0m`,
          `\x1b[90m# cwd: ${cwd}\x1b[0m`,
          `\x1b[90m# pid: ${info.pid}\x1b[0m`,
          `\x1b[90m$ ${commandLine}\x1b[0m`,
          ""
        ].join("\r\n");
        queue = queue.then(async () => {
          await writeTerminalLog(logPath, header);
          if (workerLogPath) {
            await appendTerminalLog(workerLogPath, `${header}\r\n`);
          }
          publishTerminalEvent(terminalId, { type: "start", pid: info.pid });
        });
        onStart?.(info, session);
      },
      onStdout(chunk) {
        queue = queue.then(() => appendCapturedChunk(logPath, workerLogPath, chunk));
      },
      onStderr(chunk) {
        queue = queue.then(() => appendCapturedChunk(logPath, workerLogPath, chunk));
      },
      onClose(code) {
        const footer = `\r\n\x1b[90m# process exited with code ${code ?? "unknown"}\x1b[0m\r\n`;
        queue = queue.then(async () => {
          await appendCapturedChunk(logPath, workerLogPath, Buffer.from(footer));
          publishTerminalEvent(terminalId, { type: "close", code });
        });
      }
    }
  };
  return session;
}

export async function readTerminalLog(runId: string, kind: string): Promise<string> {
  return readFile(terminalLogPath(runId, kind), "utf8").catch(() => "");
}

export function subscribeTerminalLog(terminalId: string, listener: (event: TerminalLogEvent) => void): () => void {
  const stream = streamFor(terminalId);
  stream.on("event", listener);
  return () => {
    stream.off("event", listener);
    cleanupTerminalStream(terminalId);
  };
}

export function tailTerminalLog(
  logPath: string,
  initialOffset: number,
  onData: (data: string) => void | Promise<void>,
  decoder = new StringDecoder("utf8")
): () => void {
  const tail: TerminalTail = {
    path: logPath,
    offset: Math.max(0, initialOffset),
    reading: false,
    active: true,
    decoder,
    timer: setInterval(() => {
      scheduleTerminalTailPoll(tail, onData);
    }, TAIL_POLL_MS)
  };
  const timer = tail.timer;
  timer.unref?.();
  scheduleTerminalTailPoll(tail, onData);
  return () => {
    if (!tail.active) {
      return;
    }
    tail.active = false;
    clearInterval(tail.timer);
  };
}

export async function streamTerminalLogSnapshot(
  path: string,
  onChunk: (chunk: Buffer) => boolean | void | Promise<boolean | void>
): Promise<number> {
  const handle = await open(path, "r").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (!handle) {
    return 0;
  }
  try {
    const snapshotSize = (await handle.stat()).size;
    let offset = 0;
    while (offset < snapshotSize) {
      const length = Math.min(LOG_READ_CHUNK_BYTES, snapshotSize - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
      if (await onChunk(buffer.subarray(0, bytesRead)) === false) {
        break;
      }
    }
    return offset;
  } finally {
    await handle.close();
  }
}

export function terminalKey(runId: string, kind: string): string {
  return `${runId}:${kind}`;
}

export function terminalWorkerKey(workerId: string, kind: string): string {
  return `worker:${workerId}:${kind}`;
}

export function terminalLogPath(runId: string, kind: string): string {
  return join(TERMINAL_LOG_DIR, runId, `${safeSegment(kind)}.ansi.log`);
}

export function workerTerminalLogPath(workerId: string, kind: string): string {
  return join(TERMINAL_LOG_DIR, "workers", safeSegment(workerId), `${safeSegment(kind)}.ansi.log`);
}

export function terminalWorkerContextDir(workerId: string): string {
  return join(TERMINAL_LOG_DIR, "workers", safeSegment(workerId), "context");
}

function streamFor(terminalId: string): EventEmitter {
  let stream = streams.get(terminalId);
  if (!stream) {
    stream = new EventEmitter();
    stream.setMaxListeners(100);
    streams.set(terminalId, stream);
  }
  return stream;
}

export function publishTerminalEvent(terminalId: string, event: TerminalLogEvent): void {
  streams.get(terminalId)?.emit("event", event);
}

export async function writeTerminalLog(path: string, text: string): Promise<void> {
  await enqueueLogWrite(path, async () => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, "utf8");
  });
}

export async function appendTerminalLog(path: string, chunk: Buffer | string): Promise<void> {
  await enqueueLogWrite(path, async () => {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, chunk);
  });
}

async function initializeTerminalPaths(logPath: string, workerLogPath?: string, workerContextDir?: string): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  if (workerLogPath) {
    await appendTerminalLog(workerLogPath, "");
  }
  if (workerContextDir) {
    await mkdir(workerContextDir, { recursive: true });
  }
}

async function appendCapturedChunk(logPath: string, workerLogPath: string | undefined, chunk: Buffer): Promise<void> {
  await appendTerminalLog(logPath, chunk);
  if (workerLogPath) {
    await appendTerminalLog(workerLogPath, chunk);
  }
}

function enqueueLogWrite(path: string, write: () => Promise<void>): Promise<void> {
  const previous = logWriteQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  const queued = current.then(() => undefined, () => undefined).finally(() => {
    if (logWriteQueues.get(path) === queued) {
      logWriteQueues.delete(path);
    }
  });
  logWriteQueues.set(path, queued);
  return current;
}

async function pollTerminalTail(tail: TerminalTail, onData: (data: string) => void | Promise<void>): Promise<void> {
  if (tail.reading || !tail.active) {
    return;
  }
  tail.reading = true;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(tail.path, "r").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (!handle) {
      return;
    }
    const size = (await handle.stat()).size;
    if (size < tail.offset) {
      tail.offset = 0;
      tail.decoder = new StringDecoder("utf8");
    }
    while (tail.offset < size && tail.active) {
      const length = Math.min(LOG_READ_CHUNK_BYTES, size - tail.offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, tail.offset);
      if (bytesRead === 0) {
        break;
      }
      tail.offset += bytesRead;
      const data = tail.decoder.write(buffer.subarray(0, bytesRead));
      if (data) {
        await onData(data);
      }
    }
  } finally {
    await handle?.close();
    tail.reading = false;
  }
}

function scheduleTerminalTailPoll(tail: TerminalTail, onData: (data: string) => void | Promise<void>): void {
  void pollTerminalTail(tail, onData).catch(() => undefined);
}

function cleanupTerminalStream(terminalId: string): void {
  const stream = streams.get(terminalId);
  if (stream && stream.listenerCount("event") === 0) {
    streams.delete(terminalId);
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function formatCommandLine(command: string, args: string[]): string {
  const line = shellQuote([command, ...args]);
  return line.length <= 2000
    ? line
    : `${line.slice(0, 2000)} ... [truncated ${line.length - 2000} chars]`;
}

export function shellQuote(parts: string[]): string {
  return parts.map((part) => /^[a-zA-Z0-9_./:=@%+-]+$/.test(part)
    ? part
    : `'${part.replaceAll("'", "'\\''")}'`).join(" ");
}
