export type CommandRiskLevel = "safe-read" | "workspace-write" | "dangerous";

export interface CommandClassification {
  level: CommandRiskLevel;
  reason: string;
}

const safeReadCommands = new Set(["pwd", "ls", "cat", "rg", "grep", "find", "git"]);
const workspaceWriteCommands = new Set(["npm", "node", "npx", "tsc"]);

/** Classifies a shell command so the runner can decide whether confirmation is required. */
export function classifyCommand(command: string): CommandClassification {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return { level: "dangerous", reason: "empty command" };
  }

  if (/\brm\s+-rf\b/.test(trimmed) || /\bgit\s+reset\s+--hard\b/.test(trimmed)) {
    return { level: "dangerous", reason: "destructive command" };
  }

  const [name, subcommand] = trimmed.split(/\s+/);
  // Only `git status` is considered safe-read; most other git commands can
  // mutate refs, the index, or the worktree and should pass a Confirmation Gate.
  if (name === "git" && subcommand === "status") {
    return { level: "safe-read", reason: "git status is read-only" };
  }

  if (name === "git") {
    return { level: "workspace-write", reason: "git command may change workspace state" };
  }

  if (safeReadCommands.has(name)) {
    return { level: "safe-read", reason: "known read-only inspection command" };
  }

  if (workspaceWriteCommands.has(name)) {
    return { level: "workspace-write", reason: "command may write workspace state" };
  }

  // Unknown commands are not automatically dangerous, but they still need
  // confirmation because their workspace effects are not known to the policy.
  return { level: "workspace-write", reason: "unknown command requires confirmation" };
}
