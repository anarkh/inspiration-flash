import { dirname, isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { HOOK_STATUS_MESSAGE } from "../core/constants.js";
import { pathExists, readJson, readText, writeJson, writeText } from "../utils/fs.js";
export async function configureHooks(options) {
    const changed = [];
    for (const producer of options.producers) {
        if (producer === "codex") {
            changed.push(...await configureCodexHooks(options.scope, options.events, options.cwd));
        }
        else if (producer === "claude") {
            changed.push(...await configureClaudeHooks(options.scope, options.events, options.cwd));
        }
        else {
            changed.push(...await configureAidenHooks(options.scope, options.events, options.cwd));
        }
    }
    return changed;
}
export async function clearHooks(options) {
    const changed = [];
    for (const producer of options.producers) {
        if (producer === "codex") {
            changed.push(...await clearCodexHooks(options.scope, options.cwd));
        }
        else if (producer === "claude") {
            changed.push(...await clearClaudeHooks(options.scope, options.cwd));
        }
        else {
            changed.push(...await clearAidenHooks(options.scope, options.cwd));
        }
    }
    return changed;
}
export async function configureCodexHooks(scope, events, cwd) {
    const { hooksPath, configPath } = codexPaths(scope, cwd);
    const hookConfig = await readJson(hooksPath, {});
    hookConfig.hooks = hookConfig.hooks ?? {};
    removeManagedHookCommands(hookConfig, "codex");
    for (const event of events) {
        const hookEvent = event === "stop" ? "Stop" : "PostToolUse";
        const group = {
            hooks: [{
                    type: "command",
                    command: buildHookCommand("codex", event),
                    statusMessage: HOOK_STATUS_MESSAGE
                }]
        };
        if (event === "post-tool-use") {
            group.matcher = "apply_patch|Edit|Write";
        }
        hookConfig.hooks[hookEvent] = [...(hookConfig.hooks[hookEvent] ?? []), group];
    }
    await writeJson(hooksPath, hookConfig);
    const nextToml = ensureTomlFeatureHooks(await readText(configPath) ?? "");
    await writeText(configPath, nextToml);
    return [hooksPath, configPath];
}
export async function clearCodexHooks(scope, cwd) {
    const { hooksPath } = codexPaths(scope, cwd);
    return clearManagedHooksFile(hooksPath, "codex");
}
export async function configureClaudeHooks(scope, events, cwd) {
    const settingsPath = claudeSettingsPath(scope, cwd);
    const hookConfig = await readJson(settingsPath, {});
    hookConfig.hooks = hookConfig.hooks ?? {};
    removeManagedHookCommands(hookConfig, "claude");
    for (const event of events) {
        const hookEvent = event === "stop" ? "Stop" : "PostToolUse";
        const group = {
            hooks: [{
                    type: "command",
                    command: buildHookCommand("claude", event),
                    timeout: 600
                }]
        };
        if (event === "post-tool-use") {
            group.matcher = "Write|Edit|MultiEdit";
        }
        hookConfig.hooks[hookEvent] = [...(hookConfig.hooks[hookEvent] ?? []), group];
    }
    await writeJson(settingsPath, hookConfig);
    return [settingsPath];
}
export async function clearClaudeHooks(scope, cwd) {
    return clearManagedHooksFile(claudeSettingsPath(scope, cwd), "claude");
}
export async function configureAidenHooks(scope, events, cwd) {
    const settingsPath = aidenSettingsPath(scope, cwd);
    const hookConfig = await readJson(settingsPath, {});
    hookConfig.hooks = hookConfig.hooks ?? {};
    removeManagedHookCommands(hookConfig, "aiden");
    for (const event of events) {
        const hookEvent = event === "stop" ? "Stop" : "PostToolUse";
        const group = {
            hooks: [{
                    type: "command",
                    command: buildHookCommand("aiden", event),
                    timeout: 600
                }]
        };
        if (event === "post-tool-use") {
            group.matcher = "Write|Edit|MultiEdit|apply_patch|Replace";
        }
        hookConfig.hooks[hookEvent] = [...(hookConfig.hooks[hookEvent] ?? []), group];
    }
    await writeJson(settingsPath, hookConfig);
    return [settingsPath];
}
export async function clearAidenHooks(scope, cwd) {
    return clearManagedHooksFile(aidenSettingsPath(scope, cwd), "aiden");
}
export function buildHookCommand(producer, event) {
    const nodePath = process.execPath;
    const entrypoint = currentEntrypoint();
    return `${shellQuote(nodePath)} ${shellQuote(entrypoint)} hook --producer ${producer} --event ${event}`;
}
export function ensureTomlFeatureHooks(content) {
    return ensureTomlFeatureFlags(content, {
        hooks: "true"
    });
}
function ensureTomlFeatureFlags(content, flags) {
    const lines = content.split(/\r?\n/);
    let featuresStart = -1;
    let featuresEnd = lines.length;
    for (let index = 0; index < lines.length; index += 1) {
        if (/^\s*\[features\]\s*$/.test(lines[index])) {
            featuresStart = index;
            continue;
        }
        if (featuresStart >= 0 && index > featuresStart && /^\s*\[.+\]\s*$/.test(lines[index])) {
            featuresEnd = index;
            break;
        }
    }
    if (featuresStart === -1) {
        const prefix = content.trimEnd();
        const featureLines = Object.entries(flags).map(([key, value]) => `${key} = ${value}`).join("\n");
        return `${prefix}${prefix ? "\n\n" : ""}[features]\n${featureLines}\n`;
    }
    let insertAt = featuresStart + 1;
    for (const [key, value] of Object.entries(flags)) {
        let found = false;
        const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
        for (let index = featuresStart + 1; index < featuresEnd; index += 1) {
            if (matcher.test(lines[index])) {
                lines[index] = `${key} = ${value}`;
                found = true;
                insertAt = index + 1;
                break;
            }
        }
        if (!found) {
            lines.splice(insertAt, 0, `${key} = ${value}`);
            insertAt += 1;
            featuresEnd += 1;
        }
    }
    return `${lines.join("\n").trimEnd()}\n`;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function clearManagedHooksFile(path, producer) {
    if (!await pathExists(path)) {
        return [];
    }
    const hookConfig = await readJson(path, {});
    const changed = removeManagedHookCommands(hookConfig, producer);
    if (!changed) {
        return [];
    }
    await writeJson(path, hookConfig);
    return [path];
}
function removeManagedHookCommands(config, producer) {
    if (!config.hooks) {
        return false;
    }
    let removed = false;
    for (const [event, groups] of Object.entries(config.hooks)) {
        const nextGroups = groups
            .map((group) => ({
            ...group,
            hooks: group.hooks.filter((hook) => {
                const managed = isManagedHookCommand(hook.command, producer);
                removed ||= managed;
                return !managed;
            })
        }))
            .filter((group) => group.hooks.length > 0);
        if (nextGroups.length === 0) {
            delete config.hooks[event];
        }
        else {
            config.hooks[event] = nextGroups;
        }
    }
    return removed;
}
function isManagedHookCommand(command, producer) {
    return command.includes(`hook --producer ${producer}`)
        && (command.includes("--event stop") || command.includes("--event post-tool-use"));
}
function codexPaths(scope, cwd) {
    const baseDir = scope === "global" ? join(homedir(), ".codex") : join(cwd, ".codex");
    return {
        hooksPath: join(baseDir, "hooks.json"),
        configPath: join(baseDir, "config.toml")
    };
}
function claudeSettingsPath(scope, cwd) {
    return scope === "global"
        ? join(homedir(), ".claude", "settings.json")
        : join(cwd, ".claude", "settings.local.json");
}
function aidenSettingsPath(scope, cwd) {
    return scope === "global"
        ? join(homedir(), ".aiden", "settings.json")
        : join(cwd, ".aiden", "settings.json");
}
function currentEntrypoint() {
    if (process.argv[1]) {
        return isAbsolute(process.argv[1]) ? process.argv[1] : resolve(process.cwd(), process.argv[1]);
    }
    return fileURLToPath(new URL("../cli/index.ts", import.meta.url));
}
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
export function packageRoot() {
    return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}
//# sourceMappingURL=configure.js.map