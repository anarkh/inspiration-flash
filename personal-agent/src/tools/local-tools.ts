import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { classifyCommand } from "./command-policy.ts";

export interface SearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface ConfirmationRequired {
  type: "confirmation_required";
  tool: string;
  reason: string;
  action: Record<string, unknown>;
  preview?: Record<string, unknown>;
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

/** Dispatches a provider-requested Local Tool call to the matching implementation. */
export async function executeLocalTool(workspace: string, tool: string, input: unknown): Promise<unknown> {
  const canonicalTool = normalizeToolName(tool);

  if (canonicalTool === "read_file") {
    return readFileTool(workspace, readStringField(input, "path"));
  }

  if (canonicalTool === "list_files") {
    return listFiles(workspace);
  }

  if (canonicalTool === "search_text") {
    return searchText(workspace, readStringField(input, "query"));
  }

  if (canonicalTool === "write_file") {
    return proposeWriteFile(workspace, readStringField(input, "path"), readStringField(input, "content"));
  }

  if (canonicalTool === "run_command") {
    return runCommandTool(workspace, readStringField(input, "command"));
  }

  throw new Error(`Unknown Local Tool: ${tool}`);
}

/** Maps common model aliases onto the small canonical Local Tool catalog. */
function normalizeToolName(tool: string): string {
  // Model providers often choose natural aliases for simple filesystem actions.
  // Normalize the safe, obvious variants here while keeping the public tool
  // catalog small and easy to teach.
  if (tool === "list_directory" || tool === "ls") {
    return "list_files";
  }
  return tool;
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

/** Executes a previously approved write or command action after re-validating it. */
export async function applyConfirmedToolAction(
  workspace: string,
  confirmation: unknown
): Promise<FileWritten | CommandResult | RejectedToolAction> {
  if (!isConfirmationRequired(confirmation)) {
    throw new Error("Confirmed action must be a confirmation_required result");
  }

  if (confirmation.tool === "write_file") {
    const path = readStringField(confirmation.action, "path");
    const content = readStringField(confirmation.action, "content");
    const target = resolveWorkspacePath(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return { type: "file_written", path, bytes: Buffer.byteLength(content, "utf8") };
  }

  if (confirmation.tool === "run_command") {
    const command = readStringField(confirmation.action, "command");
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

  throw new Error(`Unsupported confirmed tool action: ${confirmation.tool}`);
}

/** Checks whether a tool result is a confirmation request that needs Owner approval. */
export function isConfirmationRequired(value: unknown): value is ConfirmationRequired {
  return (
    isRecord(value) &&
    value.type === "confirmation_required" &&
    typeof value.tool === "string" &&
    typeof value.reason === "string" &&
    isRecord(value.action)
  );
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

/** Reads and validates a required string field from provider-supplied tool input. */
function readStringField(input: unknown, field: string): string {
  // Tool inputs come from provider output, so validate at the tool boundary
  // before touching the filesystem.
  if (!isRecord(input)) {
    throw new Error(`Local Tool input must be an object with ${field}`);
  }
  const value = input[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Local Tool input.${field} must be a non-empty string`);
  }
  return value;
}

/** Checks whether a value is a plain record that can be inspected safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
