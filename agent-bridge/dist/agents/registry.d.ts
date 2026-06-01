import type { Agent, BridgeResult, EndpointKind } from "../core/types.ts";
import type { AgentAdapter, DetectedCli } from "./types.ts";
import type { AgentRunContext } from "./types.ts";
export declare const agentAdapters: AgentAdapter[];
export declare function getAgentAdapter(kind: EndpointKind): AgentAdapter;
export declare function detectAllAgentClis(): Promise<DetectedCli[]>;
export declare function runAgent(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult>;
//# sourceMappingURL=registry.d.ts.map