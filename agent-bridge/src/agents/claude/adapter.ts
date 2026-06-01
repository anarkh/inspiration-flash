import { parseBridgeOutput } from "../../bridge/result-parser.ts";
import { AGENT_TIMEOUT_MS, BYPASS_ENV } from "../../core/constants.ts";
import type { Agent, BridgeResult } from "../../core/types.ts";
import type { AgentAdapter, AgentRunContext, DetectedCli } from "../types.ts";
import { findExecutable } from "../shared/detect.ts";
import { commandErrorResult } from "../shared/errors.ts";
import { spawnWithInput } from "../shared/process.ts";

const EXTRA_CANDIDATES = [
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude"
];

export const claudeAdapter: AgentAdapter = {
  kind: "claude",
  label: "Claude Code",
  defaultExecutable: "claude",
  async detect(): Promise<DetectedCli> {
    const found = await findExecutable(this.defaultExecutable, EXTRA_CANDIDATES);
    return {
      kind: this.kind,
      label: this.label,
      command: found ?? this.defaultExecutable,
      found: found !== null
    };
  },
  run: runClaudeAgent
};

async function runClaudeAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  try {
    const runCommand = context?.runner?.run.bind(context.runner) ?? spawnWithInput;
    const result = await runCommand(agent.command, [
      "-p",
      "--output-format",
      "json",
      "--permission-mode",
      "plan",
      "--max-turns",
      "3"
    ], prompt, {
      cwd,
      timeout: AGENT_TIMEOUT_MS,
      env: {
        ...process.env,
        [BYPASS_ENV]: "1"
      },
      capture: context?.capture
    });
    return parseBridgeOutput(result.stdout, agent.label);
  } catch (error) {
    return commandErrorResult(agent, error);
  }
}
