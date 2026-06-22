#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { stdin, stdout, stderr } from "node:process";
import { loadConfig, removeAllBridgeConfig, removeRoute, upsertAgent, upsertRoute } from "../config/store.ts";
import { bridgeGateTimeoutMs, BYPASS_ENV, PRODUCER_LABELS } from "../core/constants.ts";
import type { Agent, BridgeMention, BridgeMessageSender, BridgeResponse, BridgeRoute, ConfigScope, EndpointKind, HookEvent, RawDirectEnvelope, RawHookEnvelope } from "../core/types.ts";
import { clearHooks, configureHooks } from "../hooks/configure.ts";
import { mapBridgeToProducerResponse } from "../hooks/producer-response.ts";
import { detectAllAgentClis } from "../agents/registry.ts";
import { runBridge, selectRouteAgents } from "../bridge/runner.ts";
import { printDashboardUrl, printServiceStatus, restartService, runServiceForeground, startService, stopService, submitBridge, submitDirectBridge } from "../service/server.ts";
import { chooseMany, chooseOne } from "./interactive.ts";
import { resolveHookConfigCwd } from "./project-root.ts";

type HookCleanupScope = ConfigScope | "both";
type RemoveTarget = { all: true } | { all: false; producer: EndpointKind };
type PackageJson = { name?: string; version?: string };

async function main(argv: string[]): Promise<void> {
  const [command, subcommand] = argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "help") {
    printHelp(subcommand);
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    await versionCommand();
    return;
  }

  if (command === "upgrade") {
    await upgradeCommand();
    return;
  }

  if (command === "setup") {
    await setupCommand();
    return;
  }

  if (command === "list") {
    await listRoutesCommand();
    return;
  }

  if (command === "agent") {
    throw new Error("Unknown command: agent. Use `agent-bridge list`.");
  }

  if (command === "hooks") {
    await hooksCommand(subcommand);
    return;
  }

  if (command === "remove") {
    await removeCommand(argv.slice(1));
    return;
  }

  if (command === "start") {
    await startService();
    return;
  }

  if (command === "stop") {
    await stopService();
    return;
  }

  if (command === "restart") {
    await restartService();
    return;
  }

  if (command === "status") {
    await printServiceStatus();
    return;
  }

  if (command === "dashboard") {
    await printDashboardUrl();
    return;
  }

  if (command === "serve") {
    await runServiceForeground();
    return;
  }

  if (command === "hook") {
    await hookCommand(argv.slice(1));
    return;
  }

  if (command === "run") {
    await runCommand(argv.slice(1));
    return;
  }

  if (command === "send") {
    await sendCommand(argv.slice(1));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function setupCommand(): Promise<void> {
  const producers = await chooseProducerSet("Configure producer hooks", "Install hooks for every supported producer");
  const scope = await chooseConfigScope();
  const cwd = safeCwd();
  const hookCwd = await resolveHookConfigCwd(scope, cwd);
  const configured = await configureConsumerRoutes(producers);
  const changed = await configureHooks({
    producers,
    scope,
    events: ["stop"],
    cwd: hookCwd
  });
  if (scope === "project" && hookCwd !== cwd) {
    stdout.write(`Resolved project hook root:\n- ${hookCwd}\n`);
  }
  stdout.write(`Configured consumer routes:\n${configured.routes.map((route) => `- ${formatRoute(route)}`).join("\n")}\n`);
  stdout.write(`Configured consumer agents:\n${configured.agents.map((agent) => `- ${agent.label} -> ${agent.command}`).join("\n")}\n`);
  stdout.write(`Configured hooks:\n${changed.map((path) => `- ${path}`).join("\n")}\n`);
}

async function versionCommand(): Promise<void> {
  const packageJson = await readPackageJson();
  if (!packageJson.version) {
    throw new Error("Unable to read agent-bridge package version.");
  }
  stdout.write(`${packageJson.version}\n`);
}

async function upgradeCommand(): Promise<void> {
  const packageJson = await readPackageJson();
  if (!packageJson.name) {
    throw new Error("Unable to read agent-bridge package name.");
  }
  const target = `${packageJson.name}@latest`;
  stdout.write(`Upgrading ${target}...\n`);
  await runUpgradeCommand(process.env.AGENT_BRIDGE_NPM_COMMAND ?? "npm", ["install", "-g", target]);
  stdout.write([
    "Upgrade complete. Restart Agent Bridge to use the new version:",
    "  agent-bridge stop",
    "  agent-bridge start",
    ""
  ].join("\n"));
}

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as PackageJson;
}

function runUpgradeCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Upgrade command failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function chooseProducerSet(title: string, allDescription: string): Promise<EndpointKind[]> {
  const producerChoice = await chooseOne<EndpointKind | "all">(title, [
    { label: "Codex", value: "codex", description: "Codex producer hooks" },
    { label: "Claude Code", value: "claude", description: "Claude Code producer hooks" },
    { label: "Aiden", value: "aiden", description: "Aiden producer hooks" },
    { label: "All", value: "all", description: allDescription }
  ]);
  return producerChoice === "all" ? ["codex", "claude", "aiden"] : [producerChoice];
}

async function chooseConfigScope(): Promise<ConfigScope> {
  return chooseOne<ConfigScope>("Choose config scope", [
    { label: "Current project", value: "project", description: "Writes .codex/.claude/.aiden under the real project root" },
    { label: "User global", value: "global", description: "Writes ~/.codex, ~/.claude, or ~/.aiden" }
  ]);
}

async function configureConsumerRoutes(producers: EndpointKind[]): Promise<{ agents: Agent[]; routes: BridgeRoute[] }> {
  const detected = await detectAllAgentClis();
  const agentByKind = new Map<EndpointKind, Agent>();
  const routes: BridgeRoute[] = [];
  const choices = detected.map((item) => ({
    label: `${item.label}${item.found ? ` (${item.command})` : " (not found; store default command)"}`,
    value: item.kind,
    description: item.found ? "Detected locally" : "Can be configured now and installed later"
  }));

  for (const producer of producers) {
    const selected = await chooseMany<EndpointKind>(
      `Choose consumer agent(s) for ${PRODUCER_LABELS[producer]} producer`,
      choices
    );
    for (const kind of selected) {
      const cli = detected.find((item) => item.kind === kind);
      if (!cli) {
        throw new Error(`Unable to resolve agent ${kind}`);
      }
      agentByKind.set(kind, await upsertAgent(kind, cli.command));
    }
    routes.push(await upsertRoute(producer, selected));
  }
  return {
    agents: [...agentByKind.values()].sort((a, b) => a.label.localeCompare(b.label)),
    routes
  };
}

async function listRoutesCommand(): Promise<void> {
  const config = await loadConfig();
  if (config.routes.length === 0) {
    stdout.write("No routes configured. Run `agent-bridge setup` to create one.\n");
    return;
  }
  stdout.write("Configured routes:\n");
  for (const route of config.routes) {
    stdout.write(`- ${route.enabled ? "enabled" : "disabled"} ${formatRouteWithAgents(route, config.agents)}\n`);
  }
}

async function hooksCommand(subcommand: string | undefined): Promise<void> {
  if (subcommand === "clear") {
    const producers = await chooseProducerSet("Clear producer hooks", "Remove Agent Bridge hooks for every supported producer");
    const scope = await chooseConfigScope();
    const cwd = safeCwd();
    const hookCwd = await resolveHookConfigCwd(scope, cwd);
    const changed = await clearHooks({
      producers,
      scope,
      cwd: hookCwd
    });
    if (scope === "project" && hookCwd !== cwd) {
      stdout.write(`Resolved project hook root:\n- ${hookCwd}\n`);
    }
    if (changed.length === 0) {
      stdout.write("No Agent Bridge hooks found for the selected scope.\n");
      return;
    }
    stdout.write(`Cleared hooks:\n${changed.map((path) => `- ${path}`).join("\n")}\n`);
    return;
  }

  throw new Error("Usage: agent-bridge hooks clear");
}

async function removeCommand(args: string[]): Promise<void> {
  const config = await loadConfig();
  const target = await resolveRemoveTarget(args, config.routes);
  const scopes = await resolveHookCleanupScopes(args);
  const cwd = safeCwd();
  const projectHookCwd = await resolveHookConfigCwd("project", cwd);
  const producers: EndpointKind[] = target.all ? ["codex", "claude", "aiden"] : [target.producer];
  const route = target.all ? null : config.routes.find((item) => item.producer === target.producer) ?? null;
  const removedConfig = target.all
    ? await removeAllBridgeConfig()
    : await removeRoute(target.producer);
  const clearedHooks = (await Promise.all(scopes.map((scope) => clearHooks({
    producers,
    scope,
    cwd: scope === "project" ? projectHookCwd : cwd
  })))).flat();

  if (target.all) {
    stdout.write(removedConfig ? "Removed all Agent Bridge routes and consumer agents.\n" : "No Agent Bridge routes or consumer agents were configured.\n");
  } else if (route) {
    stdout.write(`Removed route: ${formatRoute(route)}\n`);
  } else {
    stdout.write(`No route configured for ${PRODUCER_LABELS[target.producer]}.\n`);
  }

  if (clearedHooks.length > 0) {
    stdout.write(`Cleared hooks:\n${clearedHooks.map((path) => `- ${path}`).join("\n")}\n`);
  } else {
    stdout.write("No matching Agent Bridge hooks found for the selected cleanup scope.\n");
  }
}

function formatRoute(route: BridgeRoute): string {
  const consumers = route.consumers.map((consumer) => PRODUCER_LABELS[consumer]).join(", ");
  return `${PRODUCER_LABELS[route.producer]} -> ${consumers}`;
}

function formatRouteWithAgents(route: BridgeRoute, agents: Agent[]): string {
  const agentsByKind = new Map(agents.map((agent) => [agent.kind, agent]));
  const consumers = route.consumers.map((consumer) => {
    const agent = agentsByKind.get(consumer);
    return agent ? `${PRODUCER_LABELS[consumer]} (${agent.command})` : `${PRODUCER_LABELS[consumer]} (not configured)`;
  }).join(", ");
  return `${PRODUCER_LABELS[route.producer]} -> ${consumers}`;
}

async function hookCommand(args: string[]): Promise<void> {
  const producer = parseEndpointFlag(args, "--producer");
  const event = parseEventFlag(args, "--event");
  const raw = await readStdinJson();
  const envelope: RawHookEnvelope = { producer, event, raw };
  const skipService = shouldSkipService(raw);
  if (!skipService) {
    stderr.write(`${await buildProgressHint(producer, event)}\n`);
  }
  const response = skipService
    ? await runBridge(envelope)
    : await submitBridge(envelope) ?? failOpenResponse();
  if (response.timedOut) {
    stderr.write(`Agent Bridge: consumer agents are still running after ${formatDuration(bridgeGateTimeoutMs())}. Producer released; check \`agent-bridge status\`.\n`);
  }
  if (response.skipped) {
    stderr.write("Agent Bridge: service unavailable; producer released without consumer check. Run `agent-bridge status` or `agent-bridge start` to inspect/fix.\n");
  }
  const mapped = mapBridgeToProducerResponse(producer, event, response);
  if (mapped.stdout) {
    stdout.write(mapped.stdout);
  }
  if (mapped.stderr) {
    stderr.write(mapped.stderr);
  }
  process.exitCode = mapped.exitCode;
}

async function buildProgressHint(producer: EndpointKind, event: HookEvent): Promise<string> {
  const config = await loadConfig().catch(() => null);
  const consumers = config ? selectRouteAgents(config, producer).map((agent) => agent.label) : [];
  const target = consumers.length > 0 ? consumers.join(", ") : "configured consumer agents";
  return `Agent Bridge: sending ${event} context to ${target}. Waiting up to ${formatDuration(bridgeGateTimeoutMs())}. Run \`agent-bridge status\` for details.`;
}

function failOpenResponse(): BridgeResponse {
  return {
    shouldContinue: false,
    skipped: true,
    result: {
      verdict: "uncertain" as const,
      summary: "Agent Bridge service unavailable; producer released without consumer check.",
      findings: [],
      suggestedPrompt: ""
    }
  };
}

function shouldSkipService(raw: unknown): boolean {
  if (process.env[BYPASS_ENV] === "1") {
    return true;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    return Boolean(record.stop_hook_active ?? record.stopHookActive);
  }
  return false;
}

async function runCommand(args: string[]): Promise<void> {
  const file = valueAfter(args, "--file");
  if (!file) {
    throw new Error("Usage: agent-bridge run --file <payload.json>");
  }
  const parsed = JSON.parse(await readFile(file, "utf8")) as RawHookEnvelope;
  const result = await runBridge(parsed);
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function sendCommand(args: string[]): Promise<void> {
  const consumer = parseEndpointFlag(args, "--to");
  const producer = parseOptionalEndpointFlag(args, "--producer") ?? "codex";
  const message = await readDirectMessage(args);
  const includeRawOutput = args.includes("--raw-output") || args.includes("--full");
  const envelope: RawDirectEnvelope = {
    consumer,
    message,
    cwd: workspaceValue(args),
    sessionId: valueAfter(args, "--session-id"),
    producer,
    turnId: valueAfter(args, "--turn-id"),
    sender: senderFromArgs(args),
    mentions: mentionsFromArgs(args)
  };
  const response = await submitDirectBridge(envelope);
  if (!response) {
    throw new Error("Agent Bridge service unavailable; direct send could not be delivered.");
  }
  stdout.write(`${JSON.stringify(sendResponseForStdout(response, includeRawOutput), null, 2)}\n`);
}

function sendResponseForStdout(response: BridgeResponse, includeRawOutput: boolean): BridgeResponse {
  if (includeRawOutput) {
    return response;
  }
  const result = { ...response.result };
  delete result.rawOutput;
  return {
    ...response,
    result
  };
}

async function readStdinJson(): Promise<unknown> {
  const text = (await readStdinText()).trim();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readDirectMessage(args: string[]): Promise<string> {
  const message = valueAfter(args, "--message");
  const file = valueAfter(args, "--file");
  const sourceCount = [message, file].filter((value) => value !== null).length;
  if (sourceCount > 1) {
    throw new Error("Use exactly one direct message source: --message, --file, or stdin.");
  }
  if (message !== null) {
    await rejectPipedDirectMessage();
    return requireNonEmptyMessage(message);
  }
  if (file !== null) {
    await rejectPipedDirectMessage();
    return requireNonEmptyMessage(await readFile(file, "utf8"));
  }
  if (stdin.isTTY) {
    throw new Error("Usage: agent-bridge send --to codex|claude|aiden --message <text> [--workspace <path>] [--session-id <id>]");
  }
  return requireNonEmptyMessage((await readStdinText()).trimEnd());
}

async function rejectPipedDirectMessage(): Promise<void> {
  if (stdin.isTTY) {
    return;
  }
  const piped = await readStdinText();
  if (piped.trim()) {
    throw new Error("Use exactly one direct message source: --message, --file, or stdin.");
  }
}

function parseEndpointFlag(args: string[], flag: string): EndpointKind {
  const value = valueAfter(args, flag);
  const endpoint = parseEndpointValue(value);
  if (endpoint) {
    return endpoint;
  }
  throw new Error(`${flag} must be codex, claude, or aiden`);
}

function parseOptionalEndpointFlag(args: string[], flag: string): EndpointKind | null {
  const value = valueAfter(args, flag);
  if (value === null) {
    return null;
  }
  const endpoint = parseEndpointValue(value);
  if (endpoint) {
    return endpoint;
  }
  throw new Error(`${flag} must be codex, claude, or aiden`);
}

function parseEventFlag(args: string[], flag: string): HookEvent {
  const value = valueAfter(args, flag);
  if (value === "stop" || value === "post-tool-use") {
    return value;
  }
  throw new Error(`${flag} must be stop or post-tool-use`);
}

function workspaceValue(args: string[]): string {
  const workspace = valueAfter(args, "--workspace");
  const cwd = valueAfter(args, "--cwd");
  if (workspace && cwd && workspace !== cwd) {
    throw new Error("Use either --workspace or --cwd, not both.");
  }
  return workspace ?? cwd ?? safeCwd();
}

function safeCwd(): string {
  try {
    return process.cwd();
  } catch {
    const pwd = process.env.PWD;
    if (pwd) {
      return pwd;
    }
    throw new Error("Current working directory no longer exists. Change to an existing directory and rerun agent-bridge.");
  }
}

function requireNonEmptyMessage(message: string): string {
  if (!message.trim()) {
    throw new Error("Direct send message must not be empty.");
  }
  return message;
}

function senderFromArgs(args: string[]): BridgeMessageSender | null {
  const type = valueAfter(args, "--sender-type");
  const openId = valueAfter(args, "--sender-open-id");
  const name = valueAfter(args, "--sender-name");
  if (!type && !openId && !name) {
    return null;
  }
  return {
    type: type ?? "user",
    ...(openId ? { openId } : {}),
    ...(name ? { name } : {})
  };
}

function mentionsFromArgs(args: string[]): BridgeMention[] {
  return valuesAfter(args, "--mention").map((value) => {
    const separator = value.includes("=") ? "=" : value.includes(":") ? ":" : "";
    if (!separator) {
      return { name: value };
    }
    const [name, ...rest] = value.split(separator);
    const openId = rest.join(separator);
    return {
      name,
      ...(openId ? { openId } : {})
    };
  }).filter((mention) => mention.name.length > 0);
}

function valuesAfter(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function valueAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}

function parseEndpointValue(value: string | null | undefined): EndpointKind | null {
  if (value === "codex" || value === "claude" || value === "aiden") {
    return value;
  }
  return null;
}

async function resolveRemoveTarget(args: string[], routes: BridgeRoute[]): Promise<RemoveTarget> {
  const positionals = positionalArgs(args);
  const flagProducer = parseEndpointValue(valueAfter(args, "--producer"));
  const positionalProducer = parseEndpointValue(positionals.find((item) => parseEndpointValue(item)) ?? null);
  const wantsAll = args.includes("--all") || positionals.includes("all");
  const producer = flagProducer ?? positionalProducer;
  if (wantsAll && producer) {
    throw new Error("Use either --all or --producer, not both.");
  }
  if (wantsAll) {
    return { all: true };
  }
  if (producer) {
    return { all: false, producer };
  }
  if (!process.stdin.isTTY) {
    throw new Error("Usage: agent-bridge remove [--producer codex|claude|aiden|--all] [--scope project|global|both]");
  }

  const routeChoices = routes.map((route) => ({
    label: formatRoute(route),
    value: route.producer,
    description: "Remove this producer-to-consumer route and its producer hooks"
  }));
  const selected = await chooseOne<EndpointKind | "all">("Choose Agent Bridge config to remove", [
    ...routeChoices,
    { label: "All", value: "all", description: "Remove all routes, consumer agents, and Agent Bridge hooks" }
  ]);
  return selected === "all" ? { all: true } : { all: false, producer: selected };
}

async function resolveHookCleanupScopes(args: string[]): Promise<ConfigScope[]> {
  const scope = parseHookCleanupScope(valueAfter(args, "--scope"));
  if (scope) {
    return expandHookCleanupScope(scope);
  }
  if (!process.stdin.isTTY) {
    return ["project"];
  }
  const selected = await chooseOne<HookCleanupScope>("Choose hook cleanup scope", [
    { label: "Current project", value: "project", description: "Clean hooks under the current directory" },
    { label: "User global", value: "global", description: "Clean hooks under your home directory" },
    { label: "Both", value: "both", description: "Clean project and global hooks" }
  ]);
  return expandHookCleanupScope(selected);
}

function parseHookCleanupScope(value: string | null): HookCleanupScope | null {
  if (value === "project" || value === "global" || value === "both") {
    return value;
  }
  if (value !== null) {
    throw new Error("--scope must be project, global, or both");
  }
  return null;
}

function expandHookCleanupScope(scope: HookCleanupScope): ConfigScope[] {
  return scope === "both" ? ["project", "global"] : [scope];
}

function positionalArgs(args: string[]): string[] {
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--producer" || arg === "--scope") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

function printHelp(topic?: string): void {
  if (topic && topic !== "--help" && topic !== "-h") {
    const helpText = COMMAND_HELP[topic];
    if (!helpText) {
      throw new Error(`Unknown help topic: ${topic}`);
    }
    stdout.write(helpText);
    return;
  }

  stdout.write(`agent-bridge

Usage:
  agent-bridge <command> [options]

Commands:
  help [command]
  version
  upgrade
  setup
  list
  remove [--producer codex|claude|aiden|--all] [--scope project|global|both]
  hooks clear
  start
  stop
  restart
  status
  dashboard
  hook --producer codex|claude|aiden --event stop
  run --file <payload.json>
  send --to codex|claude|aiden --message <text> [--workspace <path>] [--session-id <id>] [--raw-output]
`);
}

const COMMAND_HELP: Record<string, string> = {
  help: `Usage:
  agent-bridge help [command]

Show top-level help or detailed help for one command.
`,
  version: `Usage:
  agent-bridge version
  agent-bridge --version
  agent-bridge -v

Print the installed Agent Bridge version.
`,
  upgrade: `Usage:
  agent-bridge upgrade

Update the global Agent Bridge npm package to the latest version, then restart the service.
`,
  setup: `Usage:
  agent-bridge setup

Interactively configure producer hooks and producer-to-consumer routes.
`,
  list: `Usage:
  agent-bridge list

Print configured producer-to-consumer routes and consumer CLI commands.
`,
  remove: `Usage:
  agent-bridge remove [--producer codex|claude|aiden|--all] [--scope project|global|both]

Remove one route or all Agent Bridge config, then clear matching hooks.
`,
  hooks: `Usage:
  agent-bridge hooks clear

Remove only Agent Bridge managed hook commands for the selected producer and scope.
`,
  start: `Usage:
  agent-bridge start

Start the local Agent Bridge service.
`,
  stop: `Usage:
  agent-bridge stop

Stop the local Agent Bridge service.
`,
  restart: `Usage:
  agent-bridge restart

Restart the local Agent Bridge service.
`,
  status: `Usage:
  agent-bridge status

Show service health, configured routes, active runs, and recent runs.
`,
  dashboard: `Usage:
  agent-bridge dashboard

Start the local service if needed and print the dashboard URL.
`,
  hook: `Usage:
  agent-bridge hook --producer codex|claude|aiden --event stop

Internal producer hook entrypoint. Reads hook JSON from stdin.
`,
  run: `Usage:
  agent-bridge run --file <payload.json>

Run one raw hook payload file through Agent Bridge and print JSON.
`,
  send: `Usage:
  agent-bridge send --to codex|claude|aiden --message <text> [--workspace <path>] [--session-id <id>] [--raw-output]
  agent-bridge send --to codex|claude|aiden --file <message.txt> [--workspace <path>]
  printf '%s' <message> | agent-bridge send --to codex|claude|aiden [--workspace <path>]

Send a direct validation message to one consumer CLI without installing hooks.
`
};

function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m${rest}s`;
}

main(process.argv.slice(2)).catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
