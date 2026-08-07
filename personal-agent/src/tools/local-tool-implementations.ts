import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import { classifyCommand } from "./command-policy.ts";
import type { ConfirmationRequired } from "./tool-registry.ts";

export interface SearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface RejectedToolAction {
  type: "rejected";
  tool: string;
  reason: string;
  action: Record<string, unknown>;
}

export interface CommandResult {
  type: "command_result";
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FileWritten {
  type: "file_written";
  path: string;
  bytes: number;
}

/** Reads a UTF-8 file after resolving it inside the active workspace. */
export async function readFileTool(workspace: string, path: string): Promise<string> {
  return readFile(resolveWorkspacePath(workspace, path), "utf8");
}

/** Lists all files under the workspace as sorted relative paths. */
export async function listFiles(workspace: string): Promise<string[]> {
  const files: string[] = [];
  await collectFiles(workspace, workspace, files);
  return files.sort();
}

/** Searches workspace text files for literal query matches and returns line-level hits. */
export async function searchText(workspace: string, query: string): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  for (const path of await listFiles(workspace)) {
    const content = await readFileTool(workspace, path);
    const lines = content.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (text.includes(query)) {
        matches.push({ path, line: index + 1, text });
      }
    });
  }
  return matches;
}

/** Creates a confirmation request for a proposed file write without changing the file. */
export async function proposeWriteFile(
  workspace: string,
  path: string,
  content: string
): Promise<ConfirmationRequired> {
  const target = resolveWorkspacePath(workspace, path);
  return {
    type: "confirmation_required",
    tool: "write_file",
    reason: "file writes require confirmation",
    action: { path, content },
    preview: {
      path,
      bytes: Buffer.byteLength(content, "utf8"),
      exists: await pathExists(target)
    }
  };
}

/** Writes one registry-validated and Owner-approved file action. */
export async function writeConfirmedFile(workspace: string, path: string, content: string): Promise<FileWritten> {
  const target = resolveWorkspacePath(workspace, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return { type: "file_written", path, bytes: Buffer.byteLength(content, "utf8") };
}

/** Runs safe-read commands immediately and gates or rejects riskier commands. */
export async function runCommandTool(
  workspace: string,
  command: string
): Promise<CommandResult | ConfirmationRequired | RejectedToolAction> {
  const classification = classifyCommand(command);
  const action = { command };

  if (classification.level === "dangerous") {
    return { type: "rejected", tool: "run_command", reason: classification.reason, action };
  }

  if (classification.level === "workspace-write") {
    return { type: "confirmation_required", tool: "run_command", reason: classification.reason, action };
  }

  return runCommandProcess(workspace, command);
}

/** Reclassifies an approved command so policy changes cannot bypass dangerous-command rejection. */
export async function runConfirmedCommand(
  workspace: string,
  command: string
): Promise<CommandResult | RejectedToolAction> {
  const classification = classifyCommand(command);
  if (classification.level === "dangerous") {
    return {
      type: "rejected",
      tool: "run_command",
      reason: classification.reason,
      action: { command }
    };
  }
  return runCommandProcess(workspace, command);
}

/** Resolves a relative path and rejects attempts to escape the active workspace. */
function resolveWorkspacePath(workspace: string, path: string): string {
  const root = resolve(workspace);
  const target = resolve(root, path);
  // Local Tools must stay inside the workspace. This blocks absolute paths and
  // `..` traversal from reading arbitrary files on the Owner's machine.
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Path escapes workspace: ${path}`);
  }
  return target;
}

/** Recursively collects workspace file paths for list and search tools. */
async function collectFiles(workspace: string, dir: string, files: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(workspace, absolute, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(relative(workspace, absolute));
    }
  }
}

/** Returns whether a filesystem path currently exists. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Spawns a command without a shell and captures stdout, stderr, and exit code. */
async function runCommandProcess(workspace: string, command: string): Promise<CommandResult> {
  const [name, ...args] = parseCommandLine(command);
  if (!name) {
    throw new Error("run_command requires a non-empty command");
  }

  return new Promise((resolveResult, reject) => {
    const child = spawn(name, args, {
      cwd: workspace,
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${command}`));
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolveResult({
        type: "command_result",
        command,
        exitCode: exitCode ?? 1,
        stdout,
        stderr
      });
    });
  });
}

/** Tokenizes a small command string into argv parts for shell-free execution. */
function parseCommandLine(command: string): string[] {
  // Safe-read commands run without a shell, so we only need a small tokenizer for
  // whitespace and simple quotes instead of full shell syntax.
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}
