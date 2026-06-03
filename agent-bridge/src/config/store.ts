import { CONFIG_FILE, DEFAULT_PORT } from "../core/constants.ts";
import type { Agent, AppConfig, BridgeRoute, EndpointKind } from "../core/types.ts";
import { readJson, writeJson } from "../utils/fs.ts";

const AGENT_LABELS: Record<EndpointKind, string> = {
  codex: "Codex",
  claude: "Claude Code",
  aiden: "Aiden"
};

export function defaultConfig(): AppConfig {
  return {
    port: DEFAULT_PORT,
    uncertainBehavior: "continue",
    agents: [],
    routes: []
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const config = await readJson<AppConfig>(CONFIG_FILE, defaultConfig());
  return {
    ...defaultConfig(),
    ...config,
    agents: Array.isArray(config.agents) ? config.agents : [],
    routes: Array.isArray(config.routes) ? config.routes : []
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await writeJson(CONFIG_FILE, config);
}

export async function upsertAgent(kind: EndpointKind, command: string): Promise<Agent> {
  const config = await loadConfig();
  const now = new Date().toISOString();
  const agent: Agent = {
    id: kind,
    kind,
    label: AGENT_LABELS[kind],
    command,
    enabled: true,
    createdAt: config.agents.find((item) => item.id === kind)?.createdAt ?? now,
    updatedAt: now
  };
  config.agents = [
    ...config.agents.filter((item) => item.id !== kind),
    agent
  ].sort((a, b) => a.label.localeCompare(b.label));
  await saveConfig(config);
  return agent;
}

export async function upsertRoute(producer: EndpointKind, consumers: EndpointKind[]): Promise<BridgeRoute> {
  const config = await loadConfig();
  const now = new Date().toISOString();
  const existing = config.routes.find((item) => item.producer === producer);
  const route: BridgeRoute = {
    producer,
    consumers: [...new Set(consumers)].sort(),
    enabled: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  config.routes = [
    ...config.routes.filter((item) => item.producer !== producer),
    route
  ].sort((a, b) => AGENT_LABELS[a.producer].localeCompare(AGENT_LABELS[b.producer]));
  await saveConfig(config);
  return route;
}

export async function removeRoute(producer: EndpointKind): Promise<boolean> {
  const config = await loadConfig();
  const nextRoutes = config.routes.filter((item) => item.producer !== producer);
  if (nextRoutes.length === config.routes.length) {
    return false;
  }
  config.routes = nextRoutes;
  config.agents = pruneUnroutedAgents(config.agents, config.routes);
  await saveConfig(config);
  return true;
}

export async function removeAllBridgeConfig(): Promise<boolean> {
  const config = await loadConfig();
  const hadConfig = config.agents.length > 0 || config.routes.length > 0;
  if (!hadConfig) {
    return false;
  }
  config.agents = [];
  config.routes = [];
  await saveConfig(config);
  return true;
}

function pruneUnroutedAgents(agents: Agent[], routes: BridgeRoute[]): Agent[] {
  const usedConsumers = new Set(routes.flatMap((route) => route.consumers));
  return agents.filter((agent) => usedConsumers.has(agent.id));
}
