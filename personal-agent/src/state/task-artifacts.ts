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
    ...formatTaskRunSkillSelection(run.skillSelectors, run.selectedSkillPaths),
    "",
    "## Decision Trace",
    "",
    ...formatMarkdownList(formatDecisionTrace(events), "_No decision trace events recorded._"),
    "",
    "## Local Tools Used",
    "",
    ...formatMarkdownList(collectLocalToolsUsed(events), "_No local tools used._"),
    "",
    "## Skill Packs Used",
    "",
    ...formatMarkdownList(collectSkillPacksUsed(events), "_No Skill Packs used._"),
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
  if (event.type === "skill_packs" && Array.isArray(event.skillPacks)) {
    const conflictCount = countSkillPackSourceConflicts(event.skillPacks);
    const explicitCount = countExplicitSkillPackSelections(event.skillPacks);
    const overrideCount = countSkillPackPrecedenceOverrides(event.skillPacks);
    const guidanceCount = countLoadedSkillPackGuidance(event.skillPacks);
    const details = [
      conflictCount > 0
        ? `${conflictCount} same-name source alternative${conflictCount === 1 ? "" : "s"} recorded`
        : null,
      explicitCount > 0 ? `${explicitCount} explicitly selected` : null,
      overrideCount > 0 ? `${overrideCount} precedence override${overrideCount === 1 ? "" : "s"}` : null,
      guidanceCount > 0 ? `${guidanceCount} full guidance file${guidanceCount === 1 ? "" : "s"} loaded` : null
    ].filter((detail): detail is string => detail !== null);
    return `skill_packs: ${event.skillPacks.length} selected${details.length > 0 ? `; ${details.join("; ")}` : ""}`;
  }
  if (event.type === "skill_packs_confirmation" && typeof event.approved === "boolean") {
    return `skill_packs_confirmation: ${event.approved ? "approved" : "denied"}`;
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

/** Collects selected Skill Pack names and paths recorded by the runner. */
function collectSkillPacksUsed(events: unknown[]): string[] {
  const skillPacks = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    if (!isRecord(event) || event.type !== "skill_packs" || !Array.isArray(event.skillPacks)) {
      continue;
    }
    for (const skillPack of event.skillPacks) {
      if (!isRecord(skillPack) || typeof skillPack.name !== "string" || typeof skillPack.path !== "string") {
        continue;
      }
      skillPacks.set(skillPack.path, skillPack);
    }
  }
  return [...skillPacks.values()].flatMap(formatSkillPackUsed);
}

/** Formats a selected Skill Pack plus optional resource inventory for Markdown export. */
function formatSkillPackUsed(skillPack: Record<string, unknown>): string[] {
  const name = typeof skillPack.name === "string" ? skillPack.name : "unknown";
  const path = typeof skillPack.path === "string" ? skillPack.path : "unknown";
  return [
    [
      `${name} (${path})`,
      ...formatSkillPackSource(skillPack.source),
      ...formatSkillPackVersion(skillPack.version),
      ...formatSkillPackSelection(skillPack.selection),
      ...formatSkillPackGuidance(skillPack.guidance),
      ...formatSkillPackSourceConflicts(skillPack.conflicts),
      ...formatSkillPackResources(skillPack.resources)
    ].join("\n")
  ];
}

/** Formats the repeatable CLI selectors and their exact resolved paths in export metadata. */
function formatTaskRunSkillSelection(
  selectors: string[] | undefined,
  selectedPaths: string[] | undefined
): string[] {
  const lines: string[] = [];
  if (selectors && selectors.length > 0) {
    lines.push(`- Skill Selectors: ${selectors.join(", ")}`);
  }
  if (selectedPaths && selectedPaths.length > 0) {
    lines.push(`- Selected Skill Paths: ${selectedPaths.join(", ")}`);
  }
  return lines;
}

/** Formats selected source identity and precedence for exported Skill Pack audit data. */
function formatSkillPackSource(source: unknown): string[] {
  if (
    !isRecord(source) ||
    typeof source.label !== "string" ||
    typeof source.root !== "string" ||
    typeof source.priority !== "number"
  ) {
    return [];
  }
  return [`  - source: ${source.label} (priority ${source.priority})`, `  - source root: ${source.root}`];
}

/** Formats an optional Skill Pack version without inventing one for legacy packs. */
function formatSkillPackVersion(version: unknown): string[] {
  return typeof version === "string" && version.length > 0 ? [`  - version: ${version}`] : [];
}

/** Formats an explicit selector and whether it bypassed normal source precedence. */
function formatSkillPackSelection(selection: unknown): string[] {
  if (
    !isRecord(selection) ||
    selection.mode !== "explicit" ||
    typeof selection.selector !== "string" ||
    typeof selection.precedenceOverridden !== "boolean"
  ) {
    return [];
  }
  return [
    `  - selection: explicit (--skill ${selection.selector})`,
    `  - source precedence overridden: ${selection.precedenceOverridden ? "yes" : "no"}`
  ];
}

/** Formats guidance audit metadata without copying the complete `SKILL.md` body into exports. */
function formatSkillPackGuidance(guidance: unknown): string[] {
  if (!isRecord(guidance) || typeof guidance.sha256 !== "string" || typeof guidance.bytes !== "number") {
    return [];
  }
  return [`  - guidance: full SKILL.md loaded (${guidance.bytes} bytes, sha256 ${guidance.sha256})`];
}

/** Formats every same-name source alternative in the Task Run export. */
function formatSkillPackSourceConflicts(conflicts: unknown): string[] {
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return [];
  }
  const lines = [`  - source variants: ${conflicts.length} alternative${conflicts.length === 1 ? "" : "s"}`];
  for (const conflict of conflicts) {
    if (!isRecord(conflict) || typeof conflict.path !== "string" || !isRecord(conflict.source)) {
      continue;
    }
    const label = typeof conflict.source.label === "string" ? conflict.source.label : "unknown";
    const priority = typeof conflict.source.priority === "number" ? conflict.source.priority : "unknown";
    const version = typeof conflict.version === "string" ? `, version ${conflict.version}` : "";
    lines.push(`    - ${label} (priority ${priority}${version}): ${conflict.path}`);
  }
  return lines;
}

/** Formats agent-ability resource inventory paths under a selected Skill Pack. */
function formatSkillPackResources(resources: unknown): string[] {
  if (!isRecord(resources)) {
    return [];
  }

  const lines: string[] = [];
  if (Array.isArray(resources.scripts) && resources.scripts.some((path) => typeof path === "string")) {
    // Script paths are audit metadata only; exports should not imply that Skill Pack scripts ran automatically.
    lines.push("  - scripts are inventory only and are not auto-executed by the Skill Pack layer");
  }
  for (const [label, paths] of [
    ["references", resources.references],
    ["scripts", resources.scripts],
    ["evals", resources.evals]
  ] as const) {
    if (!Array.isArray(paths)) {
      continue;
    }
    for (const path of paths) {
      if (typeof path === "string") {
        lines.push(`  - ${label}: ${path}`);
      }
    }
  }
  const evalManifest = formatSkillPackEvalManifest(resources.evalManifest);
  if (evalManifest) {
    lines.push(`  - eval manifest: ${evalManifest}`);
  }
  return lines;
}

/** Formats optional Skill Pack eval manifest metadata recorded in run events. */
function formatSkillPackEvalManifest(value: unknown): string | null {
  if (!isRecord(value) || typeof value.valid !== "boolean" || typeof value.evalCount !== "number") {
    return null;
  }

  const countLabel = value.evalCount === 1 ? "eval" : "evals";
  if (value.valid) {
    return `valid (${value.evalCount} ${countLabel})`;
  }
  const reason = typeof value.reason === "string" ? value.reason : "unknown reason";
  return `invalid (${reason})`;
}

/** Counts same-name Skill Pack alternatives recorded across one selection event. */
function countSkillPackSourceConflicts(skillPacks: unknown[]): number {
  return skillPacks.reduce<number>((count, skillPack) => {
    if (!isRecord(skillPack) || !Array.isArray(skillPack.conflicts)) {
      return count;
    }
    return count + skillPack.conflicts.length;
  }, 0);
}

/** Counts Skill Packs selected through an explicit CLI selector. */
function countExplicitSkillPackSelections(skillPacks: unknown[]): number {
  return skillPacks.filter(
    (skillPack) =>
      isRecord(skillPack) &&
      isRecord(skillPack.selection) &&
      skillPack.selection.mode === "explicit"
  ).length;
}

/** Counts explicit selections that chose a normally shadowed source variant. */
function countSkillPackPrecedenceOverrides(skillPacks: unknown[]): number {
  return skillPacks.filter(
    (skillPack) =>
      isRecord(skillPack) &&
      isRecord(skillPack.selection) &&
      skillPack.selection.precedenceOverridden === true
  ).length;
}

/** Counts selected Skill Packs whose complete instruction files were loaded for the model. */
function countLoadedSkillPackGuidance(skillPacks: unknown[]): number {
  return skillPacks.filter(
    (skillPack) =>
      isRecord(skillPack) &&
      isRecord(skillPack.guidance) &&
      typeof skillPack.guidance.sha256 === "string" &&
      typeof skillPack.guidance.bytes === "number"
  ).length;
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
