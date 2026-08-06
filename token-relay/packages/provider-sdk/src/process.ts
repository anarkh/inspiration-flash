import { spawn, type ChildProcess } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessEnvironment } from "./types.ts";

export interface EphemeralCommandPaths {
  rootDir: string;
  workspaceDir: string;
  promptFile: string;
  outputFile: string;
}

export interface FileInputCommandOptions {
  command: string;
  buildArgs(paths: EphemeralCommandPaths): string[];
  input: string;
  env: ProcessEnvironment;
  timeoutMs: number;
  maxOutputBytes: number;
  killGraceMs: number;
  signal: AbortSignal;
}

export interface FileInputCommandResult {
  stdout: string;
  stderr: string;
  outputFile: string;
  exitCode: number;
}

export type CommandErrorCode =
  | "CANCELLED"
  | "TIMEOUT"
  | "OUTPUT_LIMIT"
  | "SPAWN_FAILED"
  | "PROCESS_EXIT";

export class CommandExecutionError extends Error {
  readonly code: CommandErrorCode;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor(
    code: CommandErrorCode,
    message: string,
    details: {
      stdout?: string;
      stderr?: string;
      exitCode?: number | null;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: details.cause });
    this.name = "CommandExecutionError";
    this.code = code;
    this.stdout = details.stdout ?? "";
    this.stderr = details.stderr ?? "";
    this.exitCode = details.exitCode ?? null;
  }
}

export async function runFileInputCommand(
  options: FileInputCommandOptions
): Promise<FileInputCommandResult> {
  if (options.signal.aborted) {
    throw cancelledError(options.signal.reason);
  }
  const rootDir = await mkdtemp(join(tmpdir(), "token-relay-provider-"));
  const paths: EphemeralCommandPaths = {
    rootDir,
    workspaceDir: join(rootDir, "workspace"),
    promptFile: join(rootDir, "stdin.txt"),
    outputFile: join(rootDir, "output.txt")
  };
  await mkdir(paths.workspaceDir, { recursive: true, mode: 0o700 });
  await writeFile(paths.promptFile, options.input, {
    encoding: "utf8",
    mode: 0o600
  });
  const stdinHandle = await open(paths.promptFile, "r");
  try {
    const args = options.buildArgs(paths);
    const execution = spawnAndCollect(options, args, paths.workspaceDir, stdinHandle.fd);
    await stdinHandle.close();
    const result = await execution;
    const outputFileSize = await stat(paths.outputFile)
      .then((value) => value.size)
      .catch(() => 0);
    const capturedBytes = Buffer.byteLength(result.stdout)
      + Buffer.byteLength(result.stderr);
    if (capturedBytes + outputFileSize > options.maxOutputBytes) {
      throw new CommandExecutionError(
        "OUTPUT_LIMIT",
        `Local model command exceeded ${options.maxOutputBytes} output bytes.`,
        {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        }
      );
    }
    const outputFile = await readFile(paths.outputFile, "utf8").catch(() => "");
    return {
      ...result,
      outputFile
    };
  } finally {
    await stdinHandle.close().catch(() => undefined);
    await rm(rootDir, { recursive: true, force: true });
  }
}

function spawnAndCollect(
  options: FileInputCommandOptions,
  args: string[],
  cwd: string,
  stdinFd: number
): Promise<Omit<FileInputCommandResult, "outputFile">> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(options.command, args, {
        cwd,
        env: options.env,
        shell: false,
        detached: process.platform !== "win32",
        stdio: [stdinFd, "pipe", "pipe"]
      });
    } catch (error) {
      reject(new CommandExecutionError(
        "SPAWN_FAILED",
        `Unable to start ${safeCommandName(options.command)}.`,
        { cause: error }
      ));
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let failure: CommandExecutionError | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const outputText = () => ({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    });
    const terminate = (nextFailure: CommandExecutionError) => {
      if (failure) {
        return;
      }
      failure = nextFailure;
      signalProcess(child, "SIGTERM");
      killTimer = setTimeout(
        () => signalProcess(child, "SIGKILL"),
        options.killGraceMs
      );
      killTimer.unref?.();
    };
    const onAbort = () => terminate(cancelledError(options.signal.reason));

    timeoutTimer = setTimeout(() => {
      const output = outputText();
      terminate(new CommandExecutionError(
        "TIMEOUT",
        `Local model command timed out after ${options.timeoutMs} ms.`,
        output
      ));
    }, options.timeoutMs);
    timeoutTimer.unref?.();
    options.signal.addEventListener("abort", onAbort, { once: true });

    const collect = (destination: Buffer[], chunk: Buffer) => {
      const buffer = Buffer.from(chunk);
      const remaining = Math.max(0, options.maxOutputBytes - outputBytes);
      if (remaining > 0) {
        destination.push(buffer.subarray(0, remaining));
      }
      outputBytes += buffer.length;
      if (outputBytes > options.maxOutputBytes && !failure) {
        const output = outputText();
        terminate(new CommandExecutionError(
          "OUTPUT_LIMIT",
          `Local model command exceeded ${options.maxOutputBytes} output bytes.`,
          output
        ));
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr?.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", (error) => {
      if (!failure) {
        failure = new CommandExecutionError(
          "SPAWN_FAILED",
          `Unable to start ${safeCommandName(options.command)}.`,
          { ...outputText(), cause: error }
        );
      }
    });
    child.once("close", (code) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      options.signal.removeEventListener("abort", onAbort);
      const output = outputText();
      if (failure) {
        reject(new CommandExecutionError(
          failure.code,
          failure.message,
          {
            ...output,
            exitCode: code,
            cause: failure.cause
          }
        ));
        return;
      }
      if (code !== 0) {
        reject(new CommandExecutionError(
          "PROCESS_EXIT",
          `Local model command exited with code ${code ?? "unknown"}.`,
          {
            ...output,
            exitCode: code
          }
        ));
        return;
      }
      resolve({
        ...output,
        exitCode: 0
      });
    });
  });
}

function signalProcess(
  child: ChildProcess,
  signal: NodeJS.Signals
): void {
  // child.killed only means that Node successfully sent a signal. It does not
  // mean the process exited, so checking it here would suppress the grace
  // period's SIGKILL for a process that ignores SIGTERM.
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to the direct child kill.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The child may have exited between the state check and kill.
  }
}

function cancelledError(reason: unknown): CommandExecutionError {
  const suffix = reason instanceof Error && reason.message
    ? `: ${reason.message}`
    : "";
  return new CommandExecutionError(
    "CANCELLED",
    `Local model command was cancelled${suffix}.`
  );
}

function safeCommandName(command: string): string {
  const parts = command.split(/[\\/]/);
  return parts.at(-1) || "model command";
}
