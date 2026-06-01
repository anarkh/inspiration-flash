import type { Agent, BridgeResponse, BridgeResult, BridgeRunRecord, NormalizedHookPayload } from "../core/types.ts";
export declare function loadBridgeRuns(): Promise<BridgeRunRecord[]>;
export declare function recordBridgeRunStarted(payload: NormalizedHookPayload, hash: string, agents: Agent[]): Promise<string>;
export interface ConsumerTerminalInfo {
    logPath: string;
    terminalId: string;
    terminalBackend?: "capture" | "tmux";
    tmuxSession?: string;
}
export interface ConsumerProcessInfo {
    pid: number;
    commandLine: string;
}
export declare function recordConsumerStarted(runId: string, agent: Agent, terminal?: ConsumerTerminalInfo): Promise<void>;
export declare function recordConsumerProcessStarted(runId: string, agent: Agent, processInfo: ConsumerProcessInfo): Promise<void>;
export declare function recordConsumerCompleted(runId: string, agent: Agent, result: BridgeResult): Promise<void>;
export declare function recordConsumerError(runId: string, agent: Agent, error: unknown): Promise<void>;
export declare function recordBridgeRunCompleted(runId: string, response: BridgeResponse): Promise<void>;
export declare function recordBridgeRunTimedOut(runId: string, response: BridgeResponse): Promise<void>;
export declare function recordBridgeRunLateCompleted(runId: string, result: BridgeResult): Promise<void>;
export declare function recordBridgeRunError(runId: string, error: unknown): Promise<void>;
export declare function markInterruptedBridgeRuns(reason?: string): Promise<void>;
//# sourceMappingURL=run-state.d.ts.map