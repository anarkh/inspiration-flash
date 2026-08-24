import { spawn } from "node:child_process";
import { detectKnownAgentError, firstKnownAgentErrorLine } from "../../core/agent-errors.ts";
import { hasSuccessfulCliOutput } from "../../bridge/result-parser.ts";

export interface SpawnInputOptions {
  cwd: string;
  timeout: number;
  env: NodeJS.ProcessEnv;
  capture?: SpawnCapture;
  allowKnownErrorText?: boolean;
}

export interface TtyRunOptions extends SpawnInputOptions {
  terminalInput: string;
  terminalInputMode?: TerminalInputMode;
  submitDelayMs?: number;
  inputDelayMs?: number;
  readyPattern?: RegExp;
  busyPattern?: RegExp;
  readyTimeoutMs?: number;
  readyQuietMs?: number;
}

export interface SpawnInputResult {
  stdout: string;
  stderr: string;
}

export type TerminalInputMode = "paste" | "literal";

export interface AgentCommandRunner {
  run(command: string, args: string[], input: string, options: SpawnInputOptions): Promise<SpawnInputResult>;
  runTty?(command: string, args: string[], options: TtyRunOptions): Promise<SpawnInputResult>;
}

export interface SpawnProcessInfo {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
}

export interface SpawnCapture {
  onStart?(info: SpawnProcessInfo): void;
  onStdout?(chunk: Buffer): void;
  onStderr?(chunk: Buffer): void;
  onClose?(code: number | null): void;
}

export async function spawnWithInput(
  command: string,
  args: string[],
  input: string,
  options: SpawnInputOptions
): Promise<SpawnInputResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    if (child.pid) {
      options.capture?.onStart?.({
        pid: child.pid,
        command,
        args,
        cwd: options.cwd
      });
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    };
    const resolveOnce = (result: SpawnInputResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve(result);
    };
    const inspectFatalOutput = (): void => {
      if (settled || options.allowKnownErrorText) {
        return;
      }
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      const output = [stderrText, stdoutText].filter(Boolean).join("\n");
      const knownError = detectKnownAgentError(output);
      if (!knownError) {
        return;
      }
      // The agent may legitimately quote a phrase like "invalid api key" inside a
      // successful structured result. Do not terminate that completed response.
      if (hasSuccessfulCliOutput(output)) {
        return;
      }
      const line = firstKnownAgentErrorLine(output, knownError) ?? knownError.title("Agent");
      child.kill("SIGTERM");
      rejectOnce(buildCommandError(`Agent command produced ${knownError.kind} output: ${line}`, stdout, stderr, null));
    };
    timer = setTimeout(() => {
      const error = buildCommandError(`Agent command timed out after ${options.timeout} ms`, stdout, stderr, null);
      child.kill("SIGTERM");
      rejectOnce(error);
    }, options.timeout);

    child.stdout.on("data", (chunk) => {
      const buffer = Buffer.from(chunk);
      stdout.push(buffer);
      options.capture?.onStdout?.(buffer);
      inspectFatalOutput();
    });
    child.stderr.on("data", (chunk) => {
      const buffer = Buffer.from(chunk);
      stderr.push(buffer);
      options.capture?.onStderr?.(buffer);
      inspectFatalOutput();
    });
    child.on("error", (error) => {
      rejectOnce(error);
    });
    child.on("close", (code) => {
      options.capture?.onClose?.(code);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      };
      if (code === 0) {
        resolveOnce(result);
        return;
      }
      rejectOnce(buildCommandError(`Agent command exited with code ${code}`, stdout, stderr, code));
    });
    child.stdin.end(input);
  });
}

function buildCommandError(message: string, stdout: Buffer[], stderr: Buffer[], code: number | null): Error & {
  stdout?: string;
  stderr?: string;
  code?: number | null;
} {
  const error = new Error(message) as Error & {
    stdout?: string;
    stderr?: string;
    code?: number | null;
  };
  error.stdout = Buffer.concat(stdout).toString("utf8");
  error.stderr = Buffer.concat(stderr).toString("utf8");
  error.code = code;
  return error;
}
