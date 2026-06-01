import type { Agent, BridgeResult, EndpointKind } from "../core/types.ts";
import type { AgentCommandRunner, SpawnCapture } from "./shared/process.ts";
export interface DetectedCli {
    kind: EndpointKind;
    label: string;
    command: string;
    found: boolean;
}
export interface AgentAdapter {
    kind: EndpointKind;
    label: string;
    defaultExecutable: string;
    detect(): Promise<DetectedCli>;
    run(agent: Agent, cwd: string, prompt: string, context?: AgentRunContext): Promise<BridgeResult>;
}
export interface AgentRunContext {
    capture?: SpawnCapture;
    runner?: AgentCommandRunner;
}
//# sourceMappingURL=types.d.ts.map