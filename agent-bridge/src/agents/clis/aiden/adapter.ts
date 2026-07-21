import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_TIMEOUT_MS } from "../../../core/constants.ts";
import type { Agent, BridgeResult } from "../../../core/types.ts";
import type { AgentBuildArgsOptions, AgentRunContext } from "../../types.ts";
import { bridgeBypassEnv, createCliAdapter, runCliCommand, runTtyCliCommand } from "../../shared/adapter.ts";
import { buildAgentBridgeTerminalInput } from "../../shared/agent-bridge-input.ts";

const EXTRA_CANDIDATES = [
  "/opt/homebrew/bin/aiden",
  "/usr/local/bin/aiden",
  "/usr/bin/aiden"
];
const AIDEN_READY_PATTERN = /(?:read-only|agent\s*full|agentFull|plan)\s+mode[\s\S]*toggle/i;
const AIDEN_BUSY_PATTERN = /\b(?:Working|Processing|Analyzing|Evaluating)\b|esc to interrupt/i;
const AIDEN_INTERACTIVE_TIMEOUT_MS = 30 * 60 * 1000;

export const aidenAdapter = createCliAdapter({
  kind: "aiden",
  label: "Aiden",
  defaultExecutable: "aiden",
  terminalMode: "worker",
  terminalInputMode: "paste",
  readyPattern: AIDEN_READY_PATTERN,
  extraCandidates: async () => [
    ...EXTRA_CANDIDATES,
    ...await nvmCandidates()
  ],
  buildArgs: buildAidenArgs,
  buildResumeCommand({ sessionId }) {
    return `aiden --resume ${sessionId}`;
  },
  run: runAidenAgent
});

async function runAidenAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  const contextDir = context?.workerContextDir ?? await mkdtemp(join(tmpdir(), "agent-bridge-aiden-"));
  const ownsContextDir = !context?.workerContextDir;
  const promptPath = join(contextDir, `review-context-${Date.now()}-${randomUUID()}.md`);
  try {
    await mkdir(contextDir, { recursive: true });
    if (context?.runner?.runTty) {
      return await runTtyCliCommand(agent, cwd, buildAidenArgs({
        sessionId: context.producerSessionId ?? "",
        resume: false,
        workingDir: cwd,
        contextDir
      }), context, {
        timeout: AIDEN_INTERACTIVE_TIMEOUT_MS,
        env: bridgeBypassEnv(),
        inputDelayMs: 1500,
        readyPattern: aidenAdapter.readyPattern,
        busyPattern: AIDEN_BUSY_PATTERN,
        readyTimeoutMs: 90_000,
        readyQuietMs: 1_000,
        terminalInputMode: aidenAdapter.terminalInputMode,
        submitDelayMs: 2_000,
        terminalInput: buildAidenTerminalInput(prompt, context)
      });
    }

    await writeFile(promptPath, prompt, "utf8");
    return await runCliCommand(agent, cwd, [
      "--print",
      "--no-streaming",
      "--permission-mode",
      "readOnly",
      "--model-reasoning-effort",
      "low",
      "--workspace",
      cwd,
      "--add-dir",
      contextDir,
      "--max-turns",
      "2",
      buildAidenTerminalInput(`${contextFileInstruction(context)}\n${promptPath}`, context)
    ], "", context, {
      timeout: AGENT_TIMEOUT_MS,
      env: bridgeBypassEnv()
    });
  } finally {
    if (ownsContextDir) {
      await rm(contextDir, { recursive: true, force: true });
    }
  }
}

function contextFileInstruction(context?: AgentRunContext): string {
  return context?.outputMode === "chat"
    ? "Read the bridge context file and answer the direct message in plain text:"
    : "Read the bridge context file and return only the requested JSON:";
}

function buildAidenArgs(options: AgentBuildArgsOptions): string[] {
  const args: string[] = [];
  if (options.resume && options.sessionId) {
    args.push("--resume", options.sessionId);
  }
  if (!options.disableCliBypass) {
    args.push("--permission-mode", "readOnly");
  }
  return args;
}

function buildAidenTerminalInput(message: string, context?: AgentRunContext): string {
  return buildAgentBridgeTerminalInput(message, {
    sessionId: context?.producerSessionId,
    sender: context?.producerSender,
    mentions: context?.producerMentions
  });
}

async function nvmCandidates(): Promise<string[]> {
  const root = join(homedir(), ".nvm", "versions", "node");
  try {
    const { readdir } = await import("node:fs/promises");
    const versions = await readdir(root);
    return versions.map((version) => join(root, version, "bin", "aiden"));
  } catch {
    return [];
  }
}
