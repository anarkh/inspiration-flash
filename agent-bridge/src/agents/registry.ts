import type { Agent, BridgeResult, EndpointKind } from "../core/types.ts";
import { aidenAdapter } from "./clis/aiden/adapter.ts";
import { claudeAdapter } from "./clis/claude-code/adapter.ts";
import { codexAdapter } from "./clis/codex/adapter.ts";
import type { AgentAdapter, DetectedCli } from "./types.ts";
import type { AgentRunContext } from "./types.ts";

export const agentAdapters = [
  codexAdapter,
  claudeAdapter,
  aidenAdapter
] satisfies AgentAdapter[];

export function getAgentAdapter(kind: EndpointKind): AgentAdapter {
  const adapter = agentAdapters.find((item) => item.kind === kind);
  if (!adapter) {
    throw new Error(`Unsupported agent kind: ${kind}`);
  }
  return adapter;
}

export async function detectAllAgentClis(): Promise<DetectedCli[]> {
  return Promise.all(agentAdapters.map((adapter) => adapter.detect()));
}

export async function runAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult> {
  return getAgentAdapter(agent.kind).run(agent, cwd, prompt, context);
}
