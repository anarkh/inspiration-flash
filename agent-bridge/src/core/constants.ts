import { homedir } from "node:os";
import { join } from "node:path";

export const APP_NAME = "agent-bridge";
export const DEFAULT_PORT = 47743;
const defaultConfigRoot = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const defaultStateRoot = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");

export const CONFIG_DIR = process.env.AGENT_BRIDGE_CONFIG_DIR ?? join(defaultConfigRoot, APP_NAME);
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const STATE_DIR = process.env.AGENT_BRIDGE_STATE_DIR ?? join(defaultStateRoot, APP_NAME);
export const PID_FILE = join(STATE_DIR, "service.pid");
export const PORT_FILE = join(STATE_DIR, "service-port.json");
export const RECENT_FILE = join(STATE_DIR, "recent-bridge-runs.json");
export const BRIDGE_RUNS_FILE = join(STATE_DIR, "bridge-runs.json");
export const TERMINAL_LOG_DIR = join(STATE_DIR, "terminals");
export const AGENT_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_BRIDGE_GATE_TIMEOUT_MS = 5 * 60 * 1000;
export const BRIDGE_GATE_TIMEOUT_ENV = "AGENT_BRIDGE_GATE_TIMEOUT_MS";
export const RECENT_TTL_MS = 10 * 60 * 1000;
export const MAX_DIFF_CHARS = 120_000;
export const HOOK_STATUS_MESSAGE = "Running Agent Bridge";
export const BYPASS_ENV = "AGENT_BRIDGE_BYPASS";

export const PRODUCER_LABELS = {
  codex: "Codex",
  claude: "Claude Code",
  aiden: "Aiden"
} as const;

export function bridgeGateTimeoutMs(): number {
  const configured = Number.parseInt(process.env[BRIDGE_GATE_TIMEOUT_ENV] ?? "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_BRIDGE_GATE_TIMEOUT_MS;
}
