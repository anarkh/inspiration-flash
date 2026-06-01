import type { Agent } from "../core/types.ts";
import type { SpawnProcessInfo } from "../agents/shared/process.ts";
import { type TerminalSession } from "./logs.ts";
interface AttachTmuxOptions {
    runId: string;
    agent: Agent;
    cwd: string;
    onStart?: (info: SpawnProcessInfo, terminal: TerminalSession) => void;
}
export declare function attachTmuxRunner(session: TerminalSession, options: AttachTmuxOptions): void;
export declare function sendTerminalInput(terminalId: string, data: string): Promise<boolean>;
export declare function resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean>;
export declare function tmuxSessionName(terminalId: string): string;
export {};
//# sourceMappingURL=tmux.d.ts.map