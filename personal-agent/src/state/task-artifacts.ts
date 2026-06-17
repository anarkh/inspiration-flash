import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeProjectMemorySection, type MemorySuggestion } from "./project-memory.ts";
import { readRunEvents } from "./run-events.ts";
import { readOptionalText } from "./shared.ts";
import { readLatestTaskRun, readTaskRun } from "./task-runs.ts";

export interface TaskRunExport {
  id: string;
  path: string;
}

export interface MemorySuggestionsRecord {
  id: string;
  runDir: string;
  suggestions: MemorySuggestion[];
}

/** Writes a Markdown export that summarizes one Task Run and its artifacts. */
export async function exportTaskRun(workspace: string, id?: string): Promise<TaskRunExport | null> {
  const run = id ? await readTaskRun(workspace, id) : await readLatestTaskRun(workspace);
  if (!run) {
    return null;
  }

  const report = await readOptionalText(join(run.runDir, "report.md"), "_No report.md has been written yet._\n");
  const evaluation = await readOptionalText(
    join(run.runDir, "evaluation.json"),
    "{\n  \"status\": \"not_written\"\n}\n"
  );
  const memorySuggestions = await readOptionalText(join(run.runDir, "memory-suggestions.json"), "[]\n");
  const events = await readRunEvents(run.runDir);
  const sections = [
    "# Task Run Export",
    "",
    "## Metadata",
    "",
    `- Run ID: ${run.id}`,
    `- Status: ${run.status}`,
    `- Mode: ${run.mode}`,
    `- Created At: ${run.createdAt}`,
    `- Updated At: ${run.updatedAt}`,
    `- Goal: ${run.goal}`,
    `- Success Check: ${run.successCheck}`,
    "",
    "## Decision Trace",
    "",
    ...formatMarkdownList(formatDecisionTrace(events), "_No decision trace events recorded._"),
    "",
    "## Local Tools Used",
    "",
    ...formatMarkdownList(collectLocalToolsUsed(events), "_No local tools used._"),
    "",
    "## Changed Resources",
    "",
    ...formatMarkdownList(collectChangedResources(events), "_No changed resources recorded._"),
    "",
    "## Report",
    "",
    report.trimEnd(),
    "",
    "## Evaluation",
    "",
    "```json",
    evaluation.trimEnd(),
    "```",
    ""
  ];
  if (memorySuggestions.trim() !== "[]") {
    sections.push("## Memory Suggestions", "", "```json", memorySuggestions.trimEnd(), "```", "");
  }
  sections.push(
    "## Events",
    "",
    "```json",
    JSON.stringify(events, null, 2),
    "```",
    ""
  );
  const markdown = redactExportSecrets(sections.join("\n"));

  const path = join(run.runDir, "export.md");
  // The export is regenerated on demand so it reflects the latest report,
  // evaluation, and event log without introducing another source of truth.
  await writeFile(path, markdown);
  return { id: run.id, path };
}

/** Redacts common secret formats from the shareable Markdown export only. */
function redactExportSecrets(markdown: string): string {
  const marker = "[REDACTED_SECRET]";
  return markdown
    // Redact dotenv-style assignments such as API_KEY=..., TOKEN=..., and PASSWORD=....
    .replace(
      /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(["']?)([^"'\s,}&\\]+)\2/gi,
      `$1=$2${marker}$2`
    )
    // Redact JSON-style fields such as "api_key": "..." without parsing partial snippets.
    .replace(
      /(["'])([A-Z0-9_-]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_-]*)\1\s*:\s*(["'])([^"'\\]+)\3/gi,
      `$1$2$1: $3${marker}$3`
    )
    // Redact common URL query parameters while preserving the parameter names.
    .replace(
      /([?&](?:access_token|refresh_token|id_token|client_secret|api_key|token|password|secret)=)[^&#\s"')\\]+/gi,
      `$1${marker}`
    )
    // Keep recognizable prefixes so the export still hints at which secret shape appeared.
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=?/g, `Bearer ${marker}`)
    .replace(/\b(gh[pousr])_[A-Za-z0-9_]{20,}\b/g, `$1_${marker}`)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, `sk-${marker}`);
}

/** Persists model-proposed Project Memory notes for later Owner review. */
export async function writeMemorySuggestions(runDir: string, suggestions: MemorySuggestion[]): Promise<void> {
  await writeFile(join(runDir, "memory-suggestions.json"), `${JSON.stringify(suggestions, null, 2)}\n`);
}

/** Reads reviewable Memory Suggestions for a specific or latest Task Run. */
export async function readMemorySuggestions(workspace: string, id?: string): Promise<MemorySuggestionsRecord | null> {
  const run = id ? await readTaskRun(workspace, id) : await readLatestTaskRun(workspace);
  if (!run) {
    return null;
  }

  const content = await readOptionalText(join(run.runDir, "memory-suggestions.json"), "[]\n");
  return {
    id: run.id,
    runDir: run.runDir,
    suggestions: parseMemorySuggestions(content)
  };
}

/** Writes the final human-readable Task Report for a run. */
export async function writeTaskReport(runDir: string, report: string): Promise<void> {
  await writeFile(join(runDir, "report.md"), `${report.trim()}\n`);
}

/** Writes the structured Task Evaluation JSON for a run. */
export async function writeTaskEvaluation(runDir: string, evaluation: unknown): Promise<void> {
  await writeFile(join(runDir, "evaluation.json"), `${JSON.stringify(evaluation, null, 2)}\n`);
}

/** Formats visible Task Run events into a compact human-readable trace. */
function formatDecisionTrace(events: unknown[]): string[] {
  return events.map(formatDecisionTraceEvent);
}

/** Formats one Task Run event for the Markdown Decision Trace section. */
function formatDecisionTraceEvent(event: unknown): string {
  if (!isRecord(event)) {
    return "event: unknown";
  }

  if (event.type === "plan" && typeof event.summary === "string") {
    return `plan: ${event.summary}`;
  }
  if (event.type === "message" && typeof event.content === "string") {
    return `message: ${event.content}`;
  }
  if (event.type === "tool" && typeof event.tool === "string") {
    return `tool: ${event.tool}`;
  }
  if (event.type === "tool_result" && typeof event.tool === "string") {
    const outputType = isRecord(event.output) && typeof event.output.type === "string" ? event.output.type : "observed";
    return `tool_result: ${event.tool} -> ${outputType}`;
  }
  if (event.type === "confirm" && typeof event.prompt === "string") {
    return `confirm: ${event.prompt}`;
  }
  if (event.type === "reflect" && typeof event.note === "string") {
    return `reflect: ${event.note}`;
  }
  if (event.type === "finish") {
    return "finish: report produced";
  }
  if (typeof event.type === "string") {
    return `event: ${event.type}`;
  }
  return "event: unknown";
}

/** Collects the unique Local Tool names that appeared in a Task Run event log. */
function collectLocalToolsUsed(events: unknown[]): string[] {
  const tools = new Set<string>();
  for (const event of events) {
    if (isRecord(event) && (event.type === "tool" || event.type === "tool_result") && typeof event.tool === "string") {
      tools.add(event.tool);
    }
  }
  return [...tools];
}

/** Collects resources that tool observations report as changed by the Task Run. */
function collectChangedResources(events: unknown[]): string[] {
  const resources = new Set<string>();
  for (const event of events) {
    if (!isRecord(event) || event.type !== "tool_result" || !isRecord(event.output)) {
      continue;
    }
    if (event.output.type === "file_written" && typeof event.output.path === "string") {
      resources.add(event.output.path);
    }
  }
  return [...resources];
}

/** Converts summary items into Markdown bullets with an explicit empty-state line. */
function formatMarkdownList(items: string[], emptyMessage: string): string[] {
  if (items.length === 0) {
    return [emptyMessage];
  }
  return items.map((item) => `- ${item}`);
}

/** Checks whether a value is a plain record that can be inspected safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses and validates the Memory Suggestions artifact shape. */
function parseMemorySuggestions(content: string): MemorySuggestion[] {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("memory-suggestions.json must contain an array");
  }

  return parsed.map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Memory Suggestion must be an object");
    }
    const record = value as Record<string, unknown>;
    const section = typeof record.section === "string" ? normalizeProjectMemorySection(record.section) : null;
    if (!section || typeof record.note !== "string" || typeof record.reason !== "string" || record.source !== "model_reflect") {
      throw new Error("Memory Suggestion has an invalid shape");
    }
    return {
      section,
      note: record.note,
      reason: record.reason,
      source: "model_reflect"
    };
  });
}
