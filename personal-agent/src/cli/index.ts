#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { resumeLatestTask, runChatTask, runTask } from "../agent/runner.ts";
import { confirmInTerminal } from "./confirmation.ts";
import { loadCliEnv } from "../config/env.ts";
import {
  formatStructuredSuccessChecks,
  parseStructuredSuccessCheck,
  type StructuredSuccessCheck
} from "../core/success-check.ts";
import { createConfiguredProvider } from "../model/configured-provider.ts";
import type { ModelProvider } from "../model/provider.ts";
import {
  appendProjectMemory,
  evaluateMemorySuggestionQuality,
  exportTaskRun,
  findMemorySuggestionConflict,
  formatProjectMemorySection,
  listTaskRuns,
  normalizeProjectMemorySection,
  projectMemoryContainsNote,
  readMemorySuggestions,
  readProjectMemory,
  type MemorySuggestion,
  type ProjectMemorySection,
  type TaskRunMetadata
} from "../state/store.ts";
import { runEvalCommand } from "./eval-command.ts";

// Keep default history output compact while letting callers opt into a smaller
// page size with `--limit` and page position with `--offset`.
const defaultHistoryLimit = 20;
const defaultHistoryOffset = 0;

// Keep the user-facing command name in one place so help text, page hints, and
// diagnostics stay aligned with package.json's binary name.
const cliCommandName = "a-agent";

// Keep the first Clarification Gate conservative. These patterns catch common
// commands that lack an object or success condition without blocking short but
// concrete tasks such as `ls`, `build`, or `run tests`.
const vagueTaskPatterns = [
  /^(?:do it|handle it|fix it|take care of it)[.!?]?$/,
  /^(?:处理|搞|弄)(?:一下|下)?[。.!！?？]?$/u,
  /^帮我(?:处理|搞|弄)(?:一下|下)?[。.!！?？]?$/u
];

const help = `${cliCommandName}

Usage:
  ${cliCommandName} start [--learn] [--review]
  ${cliCommandName} chat [--learn] [--review]
  ${cliCommandName} run [--learn] [--review] [--check <json>]... <task>
  ${cliCommandName} resume [--learn] [--review]
  ${cliCommandName} memory
  ${cliCommandName} memory append [--section <section>] <note>
  ${cliCommandName} memory apply-suggestions [--yes] [run-id]
  ${cliCommandName} eval golden
  ${cliCommandName} eval override [run-id] --verdict <pass|partial|fail|blocked> --reason <text>
  ${cliCommandName} eval skill-pack <name-or-path>
  ${cliCommandName} export [run-id]
  ${cliCommandName} history [--status <active|completed>] [--limit <count>] [--offset <count>]

Options:
  --check <json>  Add an objective Success Check to a run.
  --help, -h      Show this help.
`;

interface LearningFlagOptions {
  learningLens: boolean;
  modelReview: boolean;
}

interface RunCommandArgs extends LearningFlagOptions {
  task: string;
  successChecks: StructuredSuccessCheck[];
  error?: string;
}

interface RunTaskOptions extends LearningFlagOptions {
  successChecks?: StructuredSuccessCheck[];
}

/** Routes CLI arguments to the matching Personal Agent command and returns an exit code. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  loadCliEnv();

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(help);
    return 0;
  }

  const [command] = argv;
  if (command === "start") {
    const { learningLens, modelReview, error } = parseRunOptionFlags(argv.slice(1), "start");
    if (error) {
      process.stderr.write(`${cliCommandName}: ${error}\n`);
      return 1;
    }
    return runInteractiveTaskConversation({ learningLens, modelReview });
  }

  if (command === "chat") {
    const { learningLens, modelReview, error } = parseRunOptionFlags(argv.slice(1), "chat");
    if (error) {
      process.stderr.write(`${cliCommandName}: ${error}\n`);
      return 1;
    }
    return runInteractiveChatConversation({ learningLens, modelReview });
  }

  if (command === "run") {
    const parsedRun = parseRunArgs(argv.slice(1));
    if (parsedRun.error) {
      process.stderr.write(`${cliCommandName}: ${parsedRun.error}\n`);
      return 1;
    }
    const { task, learningLens, modelReview, successChecks } = parsedRun;
    if (task.length === 0) {
      process.stderr.write(`${cliCommandName}: run requires a task.\n`);
      return 1;
    }

    const clarifiedTask = await clarifyRunTaskIfNeeded(task);
    if (!clarifiedTask) {
      return 1;
    }

    const verdict = await runCliTask(clarifiedTask, { learningLens, modelReview, successChecks });
    return verdict === "fail" || verdict === "blocked" ? 1 : 0;
  }

  if (command === "history") {
    const { status, limit, offset, error } = parseHistoryArgs(argv.slice(1));
    if (error) {
      process.stderr.write(`${cliCommandName}: ${error}\n`);
      return 1;
    }

    // Fetch before filtering/pagination so `--status completed --limit 1 --offset 1`
    // means the second newest completed run, not a page of the unfiltered list.
    const filteredRuns = (await listTaskRuns(process.cwd(), Number.MAX_SAFE_INTEGER)).filter(
      (run) => !status || run.status === status
    );
    const runs = filteredRuns.slice(offset, offset + limit);
    if (runs.length === 0) {
      process.stdout.write("No Task Runs found.\n");
      return 0;
    }

    process.stdout.write(
      [
        "Recent Task Runs",
        formatHistoryPageSummary(runs.length, filteredRuns.length, offset, limit),
        ...runs.map(formatHistoryRun),
        ...formatHistoryPageHints(status, limit, offset, filteredRuns.length)
      ].join("\n")
    );
    process.stdout.write("\n");
    return 0;
  }

  if (command === "eval") {
    return runEvalCommand(argv.slice(1), process.cwd(), cliCommandName);
  }

  if (command === "export") {
    const id = argv[1];
    const result = await exportTaskRun(process.cwd(), id);
    if (!result) {
      process.stdout.write(id ? `Task Run not found: ${id}\n` : "No Task Run to export.\n");
      return id ? 1 : 0;
    }

    process.stdout.write(`Exported Task Run ${result.id} to ${result.path}\n`);
    return 0;
  }

  if (command === "memory") {
    const subcommand = argv[1];
    if (!subcommand) {
      process.stdout.write(await readProjectMemory(process.cwd()));
      return 0;
    }
    if (subcommand === "append") {
      const { note, section, error } = parseMemoryAppendArgs(argv.slice(2));
      if (error) {
        process.stderr.write(`${cliCommandName}: ${error}\n`);
        return 1;
      }
      if (note.length === 0) {
        process.stderr.write(`${cliCommandName}: memory append requires a note.\n`);
        return 1;
      }

      await appendProjectMemory(process.cwd(), note, section);
      const target = section ? ` to ${formatProjectMemorySection(section)}` : "";
      process.stdout.write(`Appended Project Memory note${target}.\n`);
      return 0;
    }
    if (subcommand === "apply-suggestions") {
      const { id, approvedAll, error } = parseMemoryApplySuggestionsArgs(argv.slice(2));
      if (error) {
        process.stderr.write(`${cliCommandName}: ${error}\n`);
        return 1;
      }

      const record = await readMemorySuggestions(process.cwd(), id);
      if (!record) {
        process.stdout.write(id ? `Task Run not found: ${id}\n` : "No Task Run suggestions found.\n");
        return id ? 1 : 0;
      }
      if (record.suggestions.length === 0) {
        process.stdout.write(`No Memory Suggestions found for Task Run ${record.id}.\n`);
        return 0;
      }

      const applied = await applyMemorySuggestions(record.suggestions, approvedAll);
      process.stdout.write(`Applied ${applied} Memory Suggestion${applied === 1 ? "" : "s"} from ${record.id}.\n`);
      return 0;
    }
  }

  if (command === "resume") {
    const { learningLens, modelReview, error } = parseRunOptionFlags(argv.slice(1), "resume");
    if (error) {
      process.stderr.write(`${cliCommandName}: ${error}\n`);
      return 1;
    }

    const result = await resumeLatestTask({
      workspace: process.cwd(),
      provider: createConfiguredProvider(),
      learningLens,
      modelReview,
      /** Prints each visible resumed model step while the run is still active. */
      logStep(message) {
        process.stderr.write(`${message}\n`);
      },
      confirmAction: confirmInTerminal
    });

    if (result.status === "not_found") {
      process.stdout.write("No Task Run to resume.\n");
      return 0;
    }
    if (result.status === "already_completed") {
      process.stdout.write(`Latest Task Run ${result.id} is already completed.\n`);
      return 0;
    }

    process.stdout.write(`Resumed Task Run ${result.id} | evaluation: ${result.evaluationVerdict}\n`);
    return result.evaluationVerdict === "fail" || result.evaluationVerdict === "blocked" ? 1 : 0;
  }

  process.stderr.write(`${cliCommandName}: command not implemented yet: ${command}\n`);
  return 1;
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  process.exitCode = await main();
}

/** Checks whether this module is the active CLI entrypoint, including npm bin symlinks. */
function isCliEntrypoint(moduleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  const modulePath = fileURLToPath(moduleUrl);
  // npm installs bin entries as symlinks. Comparing real paths keeps the CLI
  // executable when invoked through `/opt/homebrew/bin/a-agent`.
  return resolveRealPath(modulePath) === resolveRealPath(argvPath);
}

/** Resolves symlinks when possible and falls back to an absolute path for missing paths. */
function resolveRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/** Runs a minimal line-based Task Conversation until the Owner exits or stdin closes. */
async function runInteractiveTaskConversation(
  options: LearningFlagOptions = { learningLens: false, modelReview: false }
): Promise<number> {
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  let ranTask = false;
  let pendingClarificationTask: string | null = null;
  try {
    process.stderr.write("Task> ");
    for await (const answer of terminal) {
      const task = answer.trim();
      if (pendingClarificationTask) {
        if (task.length === 0) {
          process.stderr.write(`${cliCommandName}: clarification answer is required.\n`);
          process.stderr.write("Clarification> ");
          continue;
        }

        await runCliTask(formatClarifiedTask(pendingClarificationTask, task), options);
        pendingClarificationTask = null;
        ranTask = true;
        process.stderr.write("Task> ");
        continue;
      }

      if (isStartExitCommand(task)) {
        return 0;
      }
      if (task.length === 0) {
        process.stderr.write("Task> ");
        continue;
      }
      if (isAmbiguousTaskBoundary(task)) {
        writeClarificationRequest();
        pendingClarificationTask = task;
        process.stderr.write("Clarification> ");
        continue;
      }

      await runCliTask(task, options);
      ranTask = true;
      process.stderr.write("Task> ");
    }

    if (pendingClarificationTask) {
      process.stderr.write(`${cliCommandName}: clarification answer is required.\n`);
      return 1;
    }
    if (!ranTask) {
      process.stderr.write(`${cliCommandName}: start requires a task.\n`);
      return 1;
    }
    return 0;
  } finally {
    terminal.close();
  }
}

/** Runs one persistent chat conversation until the provider finishes or stdin closes. */
async function runInteractiveChatConversation(
  options: LearningFlagOptions = { learningLens: false, modelReview: false }
): Promise<number> {
  try {
    const provider = createConfiguredProvider();
    // Provider identity is printed before the first prompt response so an
    // accidental Bootstrap fallback is immediately visible to the Owner.
    process.stderr.write(`${formatProviderSelection(provider)}\n`);
    const result = await runChatTask({
      workspace: process.cwd(),
      provider,
      messages: readInteractiveChatMessages(),
      learningLens: options.learningLens,
      modelReview: options.modelReview,
      /** Prints each visible model step while the chat run is still active. */
      logStep(message) {
        process.stderr.write(`${message}\n`);
      },
      /** Prints conversational replies separately from progress logs. */
      onAgentMessage(message) {
        process.stdout.write(`${message}\n`);
      },
      confirmAction: confirmInTerminal
    });

    process.stdout.write(`Completed Chat Task Run ${result.id}\n`);
    return 0;
  } catch (error) {
    if (isEmptyChatError(error)) {
      process.stderr.write(`${cliCommandName}: chat requires a message.\n`);
      return 1;
    }
    process.stderr.write(`${cliCommandName}: chat failed: ${readUnknownErrorMessage(error)}\n`);
    return 1;
  }
}

/** Formats the selected provider and model for visible chat startup diagnostics. */
function formatProviderSelection(provider: ModelProvider): string {
  const model = provider.model ? ` (${provider.model})` : "";
  return `[agent] provider ${provider.name}${model}`;
}

/** Reads terminal chat messages, treating exit and quit as conversation stop commands. */
async function* readInteractiveChatMessages(): AsyncIterable<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write("Chat> ");
    for await (const answer of terminal) {
      const message = answer.trim();
      if (isStartExitCommand(message)) {
        return;
      }
      if (message.length === 0) {
        process.stderr.write("Chat> ");
        continue;
      }
      yield message;
      process.stderr.write("Chat> ");
    }
  } finally {
    terminal.close();
  }
}

/** Checks whether an interactive input line should leave the Task Conversation. */
function isStartExitCommand(task: string): boolean {
  const normalized = task.toLowerCase();
  return normalized === "exit" || normalized === "quit";
}

/** Detects the runner's explicit empty-chat error without masking provider failures. */
function isEmptyChatError(error: unknown): boolean {
  return error instanceof Error && error.message === "Chat Task requires at least one Owner message";
}

/** Converts unknown thrown values into stable CLI diagnostics. */
function readUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Applies a minimal Clarification Gate before `run` creates durable Task Run state. */
async function clarifyRunTaskIfNeeded(task: string): Promise<string | null> {
  if (!isAmbiguousTaskBoundary(task)) {
    return task;
  }

  writeClarificationRequest();

  if (!process.stdin.isTTY) {
    // Non-interactive invocations cannot answer a clarification prompt. Refuse
    // the run before creating state rather than guessing what the Owner meant.
    process.stderr.write(`${cliCommandName}: refusing ambiguous task without interactive clarification.\n`);
    return null;
  }

  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await terminal.question("Clarification> ")).trim();
    if (answer.length === 0) {
      process.stderr.write(`${cliCommandName}: clarification answer is required.\n`);
      return null;
    }
    return formatClarifiedTask(task, answer);
  } finally {
    terminal.close();
  }
}

/** Prints the standard Clarification Gate prompt before a task creates state. */
function writeClarificationRequest(): void {
  process.stderr.write(
    [
      "[agent] clarification required",
      "reason: task boundary is ambiguous",
      "question: What concrete outcome should this task produce?",
      ""
    ].join("\n")
  );
}

/** Combines the original ambiguous task with the Owner's clarified outcome. */
function formatClarifiedTask(task: string, clarification: string): string {
  return `${task}\n\nClarification: ${clarification}`;
}

/** Detects task requests that are too vague to run without Owner clarification. */
function isAmbiguousTaskBoundary(task: string): boolean {
  const normalized = task.normalize("NFKC").trim().toLowerCase();
  return vagueTaskPatterns.some((pattern) => pattern.test(normalized));
}

/** Runs one CLI task with the default provider, progress logging, and confirmation gates. */
async function runCliTask(
  task: string,
  options: RunTaskOptions = { learningLens: false, modelReview: false }
): Promise<"pass" | "partial" | "fail" | "blocked"> {
  const successChecks = options.successChecks ?? [];
  const successCheck =
    successChecks.length > 0
      ? `Task produces a local Task Report and satisfies: ${formatStructuredSuccessChecks(successChecks)}`
      : "Task produces a local Task Report";
  const result = await runTask({
    workspace: process.cwd(),
    goal: task,
    mode: "advisory",
    successCheck,
    successChecks,
    provider: createConfiguredProvider(),
    learningLens: options.learningLens,
    modelReview: options.modelReview,
    /** Prints each visible model step while the run is still active. */
    logStep(message) {
      process.stderr.write(`${message}\n`);
    },
    confirmAction: confirmInTerminal
  });

  process.stdout.write(`Completed Task Run ${result.id} | evaluation: ${result.evaluationVerdict}\n`);
  return result.evaluationVerdict;
}

/** Parses run flags, repeatable JSON Success Checks, and the remaining task text. */
function parseRunArgs(args: string[]): RunCommandArgs {
  let learningLens = false;
  let modelReview = false;
  const successChecks: StructuredSuccessCheck[] = [];
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--learn") {
      learningLens = true;
      continue;
    }
    if (arg === "--review") {
      modelReview = true;
      continue;
    }
    if (arg === "--check") {
      const rawCheck = args[index + 1];
      if (!rawCheck) {
        return { task: "", learningLens, modelReview, successChecks, error: "run --check requires JSON." };
      }
      try {
        successChecks.push(
          parseStructuredSuccessCheck(JSON.parse(rawCheck), `check-${successChecks.length + 1}`)
        );
      } catch (error) {
        return {
          task: "",
          learningLens,
          modelReview,
          successChecks,
          error: `invalid run --check: ${readErrorMessage(error)}`
        };
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      return {
        task: "",
        learningLens,
        modelReview,
        successChecks,
        error: "run accepts only --learn, --review, and repeated --check <json> options."
      };
    }
    taskParts.push(arg);
  }

  const duplicateId = successChecks.find(
    (check, index) => successChecks.findIndex((candidate) => candidate.id === check.id) !== index
  );
  if (duplicateId) {
    return {
      task: "",
      learningLens,
      modelReview,
      successChecks,
      error: `duplicate Success Check id: ${duplicateId.id}`
    };
  }

  return { task: taskParts.join(" ").trim(), learningLens, modelReview, successChecks };
}

/** Converts JSON and Success Check parser failures into concise CLI diagnostics. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Parses commands whose only optional flags are execution-learning and model-review switches. */
function parseRunOptionFlags(args: string[], command: string): LearningFlagOptions & { error?: string } {
  const unknownArgs = args.filter((arg) => {
    if (arg === "--learn" || arg === "--review") {
      return false;
    }
    return command !== "run" || arg.startsWith("--");
  });
  if (unknownArgs.length > 0) {
    return {
      learningLens: args.includes("--learn"),
      modelReview: args.includes("--review"),
      error: `${command} accepts only --learn and --review.`
    };
  }
  return { learningLens: args.includes("--learn"), modelReview: args.includes("--review") };
}

/** Formats one Task Run metadata record for the history command. */
function formatHistoryRun(run: TaskRunMetadata): string {
  const evaluation = formatHistoryEvaluation(run);
  const report = run.reportPath ? ` | report: ${run.reportPath}` : "";
  const checkpointDetails = [
    typeof run.latestCheckpointTurn === "number" ? `turn ${run.latestCheckpointTurn}` : undefined,
    run.latestCheckpointCreatedAt ? `created ${run.latestCheckpointCreatedAt}` : undefined
  ].filter((detail) => detail !== undefined);
  const checkpointSuffix = checkpointDetails.length > 0 ? ` (${checkpointDetails.join(", ")})` : "";
  const checkpoint = run.latestCheckpointId ? ` | checkpoint: ${run.latestCheckpointId}${checkpointSuffix}` : "";
  return `${run.id} | ${run.status} | ${run.mode}${evaluation}${report}${checkpoint} | ${run.updatedAt} | ${run.goal}`;
}

/** Formats the effective verdict while keeping a human override visibly tied to its deterministic result. */
function formatHistoryEvaluation(run: TaskRunMetadata): string {
  if (!run.evaluationVerdict) {
    return "";
  }
  if (!run.humanOverrideCount) {
    return ` | evaluation: ${run.evaluationVerdict}`;
  }

  const deterministic = run.deterministicEvaluationVerdict
    ? `; deterministic: ${run.deterministicEvaluationVerdict}`
    : "";
  const revisions = run.humanOverrideCount > 1 ? `; revisions: ${run.humanOverrideCount}` : "";
  return ` | evaluation: ${run.evaluationVerdict} (human override${deterministic}${revisions})`;
}

/** Formats a compact page summary for filtered Task Run history output. */
function formatHistoryPageSummary(currentCount: number, totalCount: number, offset: number, limit: number): string {
  const firstPosition = offset + 1;
  const lastPosition = offset + currentCount;
  return `Showing ${firstPosition}-${lastPosition} of ${totalCount} Task Runs (offset ${offset}, limit ${limit})`;
}

/** Returns copy-pasteable previous/next page commands for filtered history output. */
function formatHistoryPageHints(
  status: TaskRunMetadata["status"] | undefined,
  limit: number,
  offset: number,
  totalCount: number
): string[] {
  const hints: string[] = [];
  const statusArgs = status ? ` --status ${status}` : "";
  if (offset > 0) {
    hints.push(`Previous page: ${cliCommandName} history${statusArgs} --limit ${limit} --offset ${Math.max(0, offset - limit)}`);
  }

  const nextOffset = offset + limit;
  if (nextOffset < totalCount) {
    hints.push(`Next page: ${cliCommandName} history${statusArgs} --limit ${limit} --offset ${nextOffset}`);
  }

  return hints;
}

/** Parses compact history filters without introducing a broader CLI option framework yet. */
function parseHistoryArgs(args: string[]): {
  status?: TaskRunMetadata["status"];
  limit: number;
  offset: number;
  error?: string;
} {
  let status: TaskRunMetadata["status"] | undefined;
  let limit = defaultHistoryLimit;
  let offset = defaultHistoryOffset;

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) {
      return { limit, offset, error: "history expects option values after flags." };
    }

    if (flag === "--status") {
      if (value !== "active" && value !== "completed") {
        return { limit, offset, error: "history --status must be active or completed." };
      }
      status = value;
      continue;
    }

    if (flag === "--limit") {
      if (!/^[1-9]\d*$/.test(value)) {
        return { limit, offset, error: "history --limit must be a positive integer." };
      }
      limit = Number(value);
      continue;
    }

    if (flag === "--offset") {
      if (!/^(0|[1-9]\d*)$/.test(value)) {
        return { limit, offset, error: "history --offset must be a non-negative integer." };
      }
      offset = Number(value);
      continue;
    }

    return {
      limit,
      offset,
      error: "history accepts only --status <active|completed>, --limit <count>, and --offset <count>."
    };
  }

  return { status, limit, offset };
}

/** Parses `memory append` arguments into an optional target section and note. */
function parseMemoryAppendArgs(args: string[]): {
  note: string;
  section?: ProjectMemorySection;
  error?: string;
} {
  if (args[0] !== "--section") {
    return { note: args.join(" ").trim() };
  }

  const sectionName = args[1];
  if (!sectionName) {
    return { note: "", error: "memory append --section requires a section." };
  }

  const section = normalizeProjectMemorySection(sectionName);
  if (!section) {
    return { note: "", error: `unknown Project Memory section: ${sectionName}` };
  }

  return { note: args.slice(2).join(" ").trim(), section };
}

/** Parses `memory apply-suggestions` arguments into approval mode and optional run id. */
function parseMemoryApplySuggestionsArgs(args: string[]): {
  id?: string;
  approvedAll: boolean;
  error?: string;
} {
  const approvedAll = args.includes("--yes");
  const ids = args.filter((arg) => arg !== "--yes");
  if (ids.length > 1) {
    return { approvedAll, error: "memory apply-suggestions accepts at most one run id." };
  }

  return { approvedAll, id: ids[0] };
}

/** Applies reviewed Memory Suggestions into durable Project Memory. */
async function applyMemorySuggestions(suggestions: MemorySuggestion[], approvedAll: boolean): Promise<number> {
  let applied = 0;
  for (const suggestion of suggestions) {
    process.stdout.write(formatMemorySuggestion(suggestion));
    const quality = evaluateMemorySuggestionQuality(suggestion);
    if (!quality.ok) {
      process.stdout.write(`Skipped low-quality Memory Suggestion: ${quality.reason}.\n`);
      continue;
    }

    const memory = await readProjectMemory(process.cwd());
    const conflict = findMemorySuggestionConflict(memory, suggestion);
    if (conflict.conflict) {
      process.stdout.write(`Skipped conflicting Memory Suggestion: ${conflict.reason}: ${conflict.existingNote}\n`);
      continue;
    }

    if (projectMemoryContainsNote(memory, suggestion.note)) {
      process.stdout.write("Skipped duplicate Memory Suggestion.\n");
      continue;
    }

    const approved = approvedAll || (await confirmMemorySuggestion());
    if (!approved) {
      process.stdout.write("Skipped Memory Suggestion.\n");
      continue;
    }

    await appendProjectMemory(process.cwd(), suggestion.note, suggestion.section);
    applied += 1;
  }
  return applied;
}

/** Formats one candidate Memory Suggestion for terminal review. */
function formatMemorySuggestion(suggestion: MemorySuggestion): string {
  return [
    "Memory Suggestion",
    `section: ${formatProjectMemorySection(suggestion.section)}`,
    `note: ${suggestion.note}`,
    `reason: ${suggestion.reason}`,
    ""
  ].join("\n");
}

/** Asks the Owner whether one Memory Suggestion should be saved. */
async function confirmMemorySuggestion(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    // Non-interactive invocations must opt in explicitly with --yes; otherwise
    // suggestions remain reviewable and are not written to durable memory.
    process.stderr.write(`${cliCommandName}: refusing to apply Memory Suggestion without --yes in non-interactive mode.\n`);
    return false;
  }

  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await terminal.question("Apply this Memory Suggestion? (y/N) ");
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    terminal.close();
  }
}
