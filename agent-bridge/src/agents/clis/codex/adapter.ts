import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Agent, BridgeResult } from "../../../core/types.ts";
import type { AgentRunContext } from "../../types.ts";
import { createCliAdapter, runCliCommand } from "../../shared/adapter.ts";

const EXTRA_CANDIDATES = [
  "/Applications/Codex.app/Contents/Resources/codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex"
];

export const codexAdapter = createCliAdapter({
  kind: "codex",
  label: "Codex",
  defaultExecutable: "codex",
  extraCandidates: EXTRA_CANDIDATES,
  run: runCodexAgent
});

async function runCodexAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-bridge-codex-"));
  const outputPath = join(tempDir, "codex-last-message.txt");
  try {
    return await runCliCommand(agent, cwd, [
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
    ], prompt, context, {
      selectOutput: async (result) => {
        const lastMessage = await readFile(outputPath, "utf8").catch(() => "");
        return lastMessage.trim() || `${result.stdout}\n${result.stderr}`;
      }
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
