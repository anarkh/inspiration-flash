import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBridgeOutput } from "../../bridge/result-parser.ts";
import { AGENT_TIMEOUT_MS, BYPASS_ENV } from "../../core/constants.ts";
import type { Agent, BridgeResult } from "../../core/types.ts";
import type { AgentAdapter, AgentRunContext, DetectedCli } from "../types.ts";
import { findExecutable } from "../shared/detect.ts";
import { commandErrorResult } from "../shared/errors.ts";
import { spawnWithInput } from "../shared/process.ts";

const EXTRA_CANDIDATES = [
  "/Applications/Codex.app/Contents/Resources/codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex"
];

export const codexAdapter: AgentAdapter = {
  kind: "codex",
  label: "Codex",
  defaultExecutable: "codex",
  async detect(): Promise<DetectedCli> {
    const found = await findExecutable(this.defaultExecutable, EXTRA_CANDIDATES);
    return {
      kind: this.kind,
      label: this.label,
      command: found ?? this.defaultExecutable,
      found: found !== null
    };
  },
  run: runCodexAgent
};

async function runCodexAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-bridge-codex-"));
  const outputPath = join(tempDir, "codex-last-message.txt");
  try {
    const runCommand = context?.runner?.run.bind(context.runner) ?? spawnWithInput;
    const result = await runCommand(agent.command, [
      "exec",
      "-C",
      cwd,
      "-s",
      "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--disable",
      "hooks",
      "--output-last-message",
      outputPath,
      "-"
    ], prompt, {
      cwd,
      timeout: AGENT_TIMEOUT_MS,
      env: {
        ...process.env,
        [BYPASS_ENV]: "1"
      },
      capture: context?.capture
    });
    const lastMessage = await readFile(outputPath, "utf8").catch(() => "");
    const output = lastMessage.trim() || `${result.stdout}\n${result.stderr}`;
    return parseBridgeOutput(output, agent.label);
  } catch (error) {
    return commandErrorResult(agent, error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
