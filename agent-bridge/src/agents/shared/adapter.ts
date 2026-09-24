import { parseBridgeOutput } from "../../bridge/result-parser.ts";
import { AGENT_TIMEOUT_MS, BYPASS_ENV } from "../../core/constants.ts";
import type { Agent, BridgeOutputMode, BridgeResult, EndpointKind } from "../../core/types.ts";
import type { AgentAdapter, AgentBuildArgsOptions, AgentResumeCommandOptions, AgentRunContext, DetectedCli } from "../types.ts";
import { findExecutable } from "./detect.ts";
import { commandErrorResult } from "./errors.ts";
import { spawnWithInput, type SpawnInputResult, type TtyRunOptions } from "./process.ts";

type CandidateProvider = string[] | (() => Promise<string[]> | string[]);

export interface CliAdapterDefinition {
  kind: EndpointKind;
  label: string;
  defaultExecutable: string;
  extraCandidates?: CandidateProvider;
  terminalMode?: AgentAdapter["terminalMode"];
  terminalInputMode?: AgentAdapter["terminalInputMode"];
  readyPattern?: RegExp;
  buildArgs?: (options: AgentBuildArgsOptions) => string[];
  buildResumeCommand?: (options: AgentResumeCommandOptions) => string | null;
  run: AgentAdapter["run"];
}

export interface CliCommandOptions {
  timeout?: number;
  env?: NodeJS.ProcessEnv;
  selectOutput?: (result: SpawnInputResult) => string | Promise<string>;
}

export type TtyCliCommandOptions = Omit<TtyRunOptions, "cwd" | "env" | "capture"> & {
  env?: NodeJS.ProcessEnv;
};

export function createCliAdapter(definition: CliAdapterDefinition): AgentAdapter {
  return {
    kind: definition.kind,
    label: definition.label,
    defaultExecutable: definition.defaultExecutable,
    terminalMode: definition.terminalMode,
    terminalInputMode: definition.terminalInputMode,
    readyPattern: definition.readyPattern,
    buildArgs: definition.buildArgs,
    buildResumeCommand: definition.buildResumeCommand,
    async detect(): Promise<DetectedCli> {
      const candidates = await resolveCandidates(definition.extraCandidates);
      const found = await findExecutable(definition.defaultExecutable, candidates);
      return {
        kind: definition.kind,
        label: definition.label,
        command: found ?? definition.defaultExecutable,
        found: found !== null
      };
    },
    run: definition.run
  };
}

export async function runCliCommand(
  agent: Agent,
  cwd: string,
  args: string[],
  input: string,
  context?: AgentRunContext,
  options: CliCommandOptions = {}
): Promise<BridgeResult> {
  try {
    const runCommand = context?.runner?.run.bind(context.runner) ?? spawnWithInput;
    const result = await runCommand(agent.command, args, input, {
      cwd,
      timeout: options.timeout ?? AGENT_TIMEOUT_MS,
      env: options.env ?? bridgeBypassEnv(),
      capture: context?.capture,
      allowKnownErrorText: context?.outputMode === "chat"
    });
    const output = options.selectOutput ? await options.selectOutput(result) : result.stdout;
    return parseCliOutput(agent, output, context?.outputMode);
  } catch (error) {
    return commandErrorResult(agent, error);
  }
}

export async function runTtyCliCommand(
  agent: Agent,
  cwd: string,
  args: string[],
  context: AgentRunContext,
  options: TtyCliCommandOptions
): Promise<BridgeResult> {
  try {
    if (!context.runner?.runTty) {
      throw new Error(`${agent.label} does not have an interactive terminal runner.`);
    }
    const result = await context.runner.runTty(agent.command, args, {
      ...options,
      cwd,
      env: options.env ?? bridgeBypassEnv(),
      capture: context.capture,
      allowKnownErrorText: context.outputMode === "chat"
    });
    return parseCliOutput(agent, result.stdout, context.outputMode);
  } catch (error) {
    return commandErrorResult(agent, error);
  }
}

export function parseCliOutput(agent: Agent, output: string, mode?: BridgeOutputMode): BridgeResult {
  return parseBridgeOutput(output, agent.label, { mode });
}

export function bridgeBypassEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...env,
    [BYPASS_ENV]: "1"
  };
}

async function resolveCandidates(provider: CandidateProvider | undefined): Promise<string[]> {
  if (!provider) {
    return [];
  }
  return Array.isArray(provider) ? provider : await provider();
}
