#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { resumeLatestTask, runTask } from "../agent/runner.ts";
import { confirmInTerminal } from "./confirmation.ts";
import { loadCliEnv } from "../config/env.ts";
import { createConfiguredProvider } from "../model/configured-provider.ts";
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

const help = `personal-agent

Usage:
  personal-agent start
  personal-agent run <task>
  personal-agent resume
  personal-agent memory
  personal-agent memory append [--section <section>] <note>
  personal-agent memory apply-suggestions [--yes] [run-id]
  personal-agent export [run-id]
  personal-agent history

Options:
  --help, -h    Show this help.
`;

/** Routes CLI arguments to the matching Personal Agent command and returns an exit code. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  loadCliEnv();

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(help);
    return 0;
  }

  const [command] = argv;
  if (command === "run") {
    const task = argv.slice(1).join(" ").trim();
    if (task.length === 0) {
      process.stderr.write("personal-agent: run requires a task.\n");
      return 1;
    }

    const result = await runTask({
      workspace: process.cwd(),
      goal: task,
      mode: "advisory",
      successCheck: "Task produces a local Task Report",
      provider: createConfiguredProvider(),
      /** Prints each visible model step while the run is still active. */
      logStep(message) {
        process.stderr.write(`${message}\n`);
      },
      confirmAction: confirmInTerminal
    });

    process.stdout.write(`Completed Task Run ${result.id}\n`);
    return 0;
  }

  if (command === "history") {
    const runs = await listTaskRuns(process.cwd(), 20);
    if (runs.length === 0) {
      process.stdout.write("No Task Runs found.\n");
      return 0;
    }

    process.stdout.write(["Recent Task Runs", ...runs.map(formatHistoryRun)].join("\n"));
    process.stdout.write("\n");
    return 0;
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
        process.stderr.write(`personal-agent: ${error}\n`);
        return 1;
      }
      if (note.length === 0) {
        process.stderr.write("personal-agent: memory append requires a note.\n");
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
        process.stderr.write(`personal-agent: ${error}\n`);
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
    const result = await resumeLatestTask({
      workspace: process.cwd(),
      provider: createConfiguredProvider(),
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

    process.stdout.write(`Resumed Task Run ${result.id}\n`);
    return 0;
  }

  process.stderr.write(`personal-agent: command not implemented yet: ${command}\n`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}

/** Formats one Task Run metadata record for the history command. */
function formatHistoryRun(run: TaskRunMetadata): string {
  return `${run.id} | ${run.status} | ${run.mode} | ${run.updatedAt} | ${run.goal}`;
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
    process.stderr.write("personal-agent: refusing to apply Memory Suggestion without --yes in non-interactive mode.\n");
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
