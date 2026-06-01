export declare const APP_NAME = "agent-bridge";
export declare const DEFAULT_PORT = 47743;
export declare const CONFIG_DIR: string;
export declare const CONFIG_FILE: string;
export declare const STATE_DIR: string;
export declare const PID_FILE: string;
export declare const PORT_FILE: string;
export declare const RECENT_FILE: string;
export declare const BRIDGE_RUNS_FILE: string;
export declare const TERMINAL_LOG_DIR: string;
export declare const AGENT_TIMEOUT_MS: number;
export declare const DEFAULT_BRIDGE_GATE_TIMEOUT_MS: number;
export declare const BRIDGE_GATE_TIMEOUT_ENV = "AGENT_BRIDGE_GATE_TIMEOUT_MS";
export declare const RECENT_TTL_MS: number;
export declare const MAX_DIFF_CHARS = 120000;
export declare const HOOK_STATUS_MESSAGE = "Running Agent Bridge";
export declare const BYPASS_ENV = "AGENT_BRIDGE_BYPASS";
export declare const PRODUCER_LABELS: {
    readonly codex: "Codex";
    readonly claude: "Claude Code";
    readonly aiden: "Aiden";
};
export declare function bridgeGateTimeoutMs(): number;
//# sourceMappingURL=constants.d.ts.map