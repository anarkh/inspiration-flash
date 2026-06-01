import type { Agent } from "../core/types.ts";
import type { AgentCommandRunner, SpawnCapture, SpawnProcessInfo } from "../agents/shared/process.ts";
export interface TerminalSession {
    terminalId: string;
    logPath: string;
    backend: "capture" | "tmux";
    tmuxSession?: string;
    capture: SpawnCapture;
    runner?: AgentCommandRunner;
    flush(): Promise<void>;
}
export interface TerminalLogEvent {
    type: "start" | "stdout" | "stderr" | "close";
    data?: string;
    pid?: number;
    code?: number | null;
}
export declare function createTerminalSession(runId: string, agent: Agent, cwd: string, onStart?: (info: SpawnProcessInfo, terminal: TerminalSession) => void): TerminalSession;
export declare function readTerminalLog(runId: string, kind: string): Promise<string>;
export declare function subscribeTerminalLog(terminalId: string, listener: (event: TerminalLogEvent) => void): () => void;
export declare function ensureTerminalLogTail(terminalId: string, logPath: string, fromEnd?: boolean): void;
export declare function terminalKey(runId: string, kind: string): string;
export declare function terminalLogPath(runId: string, kind: string): string;
export declare function publishTerminalEvent(terminalId: string, event: TerminalLogEvent): void;
export declare function writeTerminalLog(path: string, text: string): Promise<void>;
export declare function appendTerminalLog(path: string, chunk: Buffer | string): Promise<void>;
export declare function formatCommandLine(command: string, args: string[]): string;
export declare function shellQuote(parts: string[]): string;
//# sourceMappingURL=logs.d.ts.map