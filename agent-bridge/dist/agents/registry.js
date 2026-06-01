import { aidenAdapter } from "./aiden/adapter.js";
import { claudeAdapter } from "./claude/adapter.js";
import { codexAdapter } from "./codex/adapter.js";
export const agentAdapters = [
    codexAdapter,
    claudeAdapter,
    aidenAdapter
];
export function getAgentAdapter(kind) {
    const adapter = agentAdapters.find((item) => item.kind === kind);
    if (!adapter) {
        throw new Error(`Unsupported agent kind: ${kind}`);
    }
    return adapter;
}
export async function detectAllAgentClis() {
    return Promise.all(agentAdapters.map((adapter) => adapter.detect()));
}
export async function runAgent(agent, cwd, prompt, context) {
    return getAgentAdapter(agent.kind).run(agent, cwd, prompt, context);
}
//# sourceMappingURL=registry.js.map