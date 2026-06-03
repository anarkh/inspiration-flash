import type { Agent, BridgeResult } from "../../../core/types.ts";
import type { AgentRunContext } from "../../types.ts";
import { createCliAdapter, runCliCommand } from "../../shared/adapter.ts";

const EXTRA_CANDIDATES = [
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude"
];

export const claudeAdapter = createCliAdapter({
  kind: "claude",
  label: "Claude Code",
  defaultExecutable: "claude",
  extraCandidates: EXTRA_CANDIDATES,
  run: runClaudeAgent
});

async function runClaudeAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  return runCliCommand(agent, cwd, [
    "-p",
    "--output-format",
    "json",
    "--permission-mode",
    "plan",
    "--max-turns",
    "3"
  ], prompt, context);
}
