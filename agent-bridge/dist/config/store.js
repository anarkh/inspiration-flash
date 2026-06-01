import { CONFIG_FILE, DEFAULT_PORT } from "../core/constants.js";
import { readJson, writeJson } from "../utils/fs.js";
const AGENT_LABELS = {
    codex: "Codex",
    claude: "Claude Code",
    aiden: "Aiden"
};
export function defaultConfig() {
    return {
        port: DEFAULT_PORT,
        uncertainBehavior: "continue",
        agents: [],
        routes: []
    };
}
export async function loadConfig() {
    const config = await readJson(CONFIG_FILE, defaultConfig());
    return {
        ...defaultConfig(),
        ...config,
        agents: Array.isArray(config.agents) ? config.agents : [],
        routes: Array.isArray(config.routes) ? config.routes : []
    };
}
export async function saveConfig(config) {
    await writeJson(CONFIG_FILE, config);
}
export async function upsertAgent(kind, command) {
    const config = await loadConfig();
    const now = new Date().toISOString();
    const agent = {
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
export async function upsertRoute(producer, consumers) {
    const config = await loadConfig();
    const now = new Date().toISOString();
    const existing = config.routes.find((item) => item.producer === producer);
    const route = {
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
export async function removeRoute(producer) {
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
export async function removeAllBridgeConfig() {
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
function pruneUnroutedAgents(agents, routes) {
    const usedConsumers = new Set(routes.flatMap((route) => route.consumers));
    return agents.filter((agent) => usedConsumers.has(agent.id));
}
//# sourceMappingURL=store.js.map