import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { isJsonValueType, validateJsonSchemaDeclaration } from "../core/json-schema.ts";
import {
  resolveSkillPackSources,
  type ResolveSkillPackSourcesOptions,
  type SkillPackSource
} from "./skill-sources.ts";
import type { SkillPackGuidanceMap } from "./skill-guidance.ts";

/** Describes one concrete Skill Pack variant before same-name precedence is applied. */
export interface SkillPackVariantSummary {
  name: string;
  description: string;
  path: string;
  version?: string;
  source: SkillPackSource;
  resources?: SkillPackResources;
}

/** Describes the selected variant and any same-name source alternatives retained for audit. */
export interface SkillPackSummary extends SkillPackVariantSummary {
  conflicts?: SkillPackVariantSummary[];
  selection?: SkillPackSelectionMetadata;
}

/** Records an explicit Owner selector and whether it overrides normal source precedence. */
export interface SkillPackSelectionMetadata {
  mode: "explicit";
  selector: string;
  precedenceOverridden: boolean;
}

export interface SkillPackResources {
  references: string[];
  scripts: string[];
  evals: string[];
  evalManifest?: SkillPackEvalManifestSummary;
}

export interface SkillPackEvalManifestSummary {
  path: string;
  valid: boolean;
  evalCount: number;
  reason?: string;
}

/** Describes a selected Skill Pack plus matcher metadata used by the runner. */
export interface SelectedSkillPackSummary extends SkillPackSummary {
  score: number;
  explicitlyNamed: boolean;
}

export interface SelectRelevantSkillPacksInput {
  workspace: string;
  goal: string;
  successCheck?: string;
  maxSkillPacks?: number;
  sourceOptions?: ResolveSkillPackSourcesOptions;
}

interface ScoredSkillPack {
  skillPack: SkillPackSummary;
  score: number;
  explicitlyNamed: boolean;
  index: number;
}

const defaultRelevantSkillPackLimit = 4;
const skillPackStopWords = new Set([
  "a",
  "and",
  "for",
  "in",
  "of",
  "the",
  "to",
  "use",
  "when",
  "with"
]);

/** Selects relevant local Skill Packs and formats them for provider context. */
export async function selectRelevantSkillPacks(input: SelectRelevantSkillPacksInput): Promise<string> {
  return formatSkillPackContext(await selectRelevantSkillPackSummaries(input));
}

/** Selects relevant local Skill Packs as structured summaries for events and exports. */
export async function selectRelevantSkillPackSummaries(
  input: SelectRelevantSkillPacksInput
): Promise<SkillPackSummary[]> {
  return (await selectRelevantSkillPackMatches(input)).map(stripSkillPackMatcherMetadata);
}

/** Selects relevant local Skill Packs with scores and explicit-mention metadata. */
export async function selectRelevantSkillPackMatches(
  input: SelectRelevantSkillPacksInput
): Promise<SelectedSkillPackSummary[]> {
  const skillPacks = await discoverSkillPacks(input.workspace, input.sourceOptions);
  const query = `${input.goal} ${input.successCheck ?? ""}`;
  const queryTerms = extractSkillPackTerms(query);
  if (skillPacks.length === 0 || queryTerms.size === 0) {
    return [];
  }

  const scored = skillPacks
    .map((skillPack, index) => ({
      skillPack,
      score: scoreSkillPack(skillPack, queryTerms),
      explicitlyNamed: skillPackIsExplicitlyNamed(skillPack, query),
      index
    }))
    .filter((item) => item.score > 0 || item.explicitlyNamed)
    .sort(
      (left, right) =>
        Number(right.explicitlyNamed) - Number(left.explicitlyNamed) ||
        right.score - left.score ||
        left.index - right.index
    );

  if (scored.length === 0) {
    return [];
  }

  return scored
    .slice(0, Math.max(1, input.maxSkillPacks ?? defaultRelevantSkillPackLimit))
    .map(formatSelectedSkillPack);
}

/** Removes score and mention fields before exposing a plain Skill Pack summary. */
function stripSkillPackMatcherMetadata(skillPack: SelectedSkillPackSummary): SkillPackSummary {
  return {
    name: skillPack.name,
    description: skillPack.description,
    path: skillPack.path,
    version: skillPack.version,
    source: skillPack.source,
    resources: skillPack.resources,
    conflicts: skillPack.conflicts,
    selection: skillPack.selection
  };
}

/** Flattens a scored internal record into the public selected-skill shape. */
function formatSelectedSkillPack(item: ScoredSkillPack): SelectedSkillPackSummary {
  return {
    name: item.skillPack.name,
    description: item.skillPack.description,
    path: item.skillPack.path,
    version: item.skillPack.version,
    source: item.skillPack.source,
    resources: item.skillPack.resources,
    conflicts: item.skillPack.conflicts,
    selection: item.skillPack.selection,
    score: item.score,
    explicitlyNamed: item.explicitlyNamed
  };
}

/** Checks whether the Owner explicitly named a Skill Pack in the task text. */
function skillPackIsExplicitlyNamed(skillPack: SkillPackSummary, query: string): boolean {
  const normalizedQuery = normalizeSkillPackMention(query);
  const normalizedName = normalizeSkillPackMention(skillPack.name);
  const normalizedPathName = normalizeSkillPackMention(fallbackSkillName(skillPack.path));
  return normalizedQuery.includes(normalizedName) || normalizedQuery.includes(normalizedPathName);
}

/** Discovers Skill Packs across ordered workspace, user, package, and configured catalogs. */
export async function discoverSkillPacks(
  workspace: string,
  options: ResolveSkillPackSourcesOptions = {}
): Promise<SkillPackSummary[]> {
  const sources = await resolveSkillPackSources(workspace, options);
  const variants: SkillPackVariantSummary[] = [];
  for (const source of sources) {
    variants.push(...(await discoverSkillPacksFromSource(workspace, source)));
  }
  return resolveSkillPackConflicts(variants);
}

/** Preserves the original workspace-only discovery API for focused callers and compatibility. */
export async function discoverWorkspaceSkillPacks(workspace: string): Promise<SkillPackSummary[]> {
  return discoverSkillPacks(workspace, {
    userSkillsRoot: null,
    packageSkillsRoot: null,
    configuredRoots: []
  });
}

/** Reads every valid Skill Pack directory from one catalog in deterministic name order. */
async function discoverSkillPacksFromSource(
  workspace: string,
  source: SkillPackSource
): Promise<SkillPackVariantSummary[]> {
  const entries = (await readDirectoryIfPresent(source.root)).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const skillPacks: SkillPackVariantSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }

    const skillDir = join(source.root, entry.name);
    const absolutePath = join(skillDir, "SKILL.md");
    const displayPath = formatSkillPackPath(workspace, source, absolutePath);
    const content = await readOptionalSkillFile(absolutePath);
    if (!content) {
      continue;
    }

    skillPacks.push({
      ...parseSkillPackSummary(displayPath, content),
      source,
      resources: await collectSkillPackResources(skillDir, dirname(displayPath))
    });
  }

  return skillPacks;
}

/** Chooses the first same-name variant and attaches lower-priority variants as conflicts. */
function resolveSkillPackConflicts(variants: SkillPackVariantSummary[]): SkillPackSummary[] {
  const winners = new Map<string, SkillPackSummary>();
  for (const variant of variants) {
    const identity = normalizeSkillPackMention(variant.name);
    const winner = winners.get(identity);
    if (!winner) {
      winners.set(identity, { ...variant });
      continue;
    }
    winner.conflicts = [...(winner.conflicts ?? []), variant];
  }
  return [...winners.values()];
}

/** Uses workspace-relative paths locally and absolute paths for external Skill Pack catalogs. */
function formatSkillPackPath(workspace: string, source: SkillPackSource, absolutePath: string): string {
  if (source.kind === "workspace") {
    return normalizePathSeparators(relative(resolve(workspace), absolutePath));
  }
  return normalizePathSeparators(resolve(absolutePath));
}

/** Normalizes platform separators so persisted Skill Pack paths compare consistently. */
function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Collects non-executable resource paths that an agent-ability style Skill Pack exposes. */
async function collectSkillPackResources(skillDir: string, relativeDir: string): Promise<SkillPackResources> {
  return {
    references: await collectRelativeFiles(join(skillDir, "references"), `${relativeDir}/references`),
    scripts: await collectRelativeFiles(join(skillDir, "scripts"), `${relativeDir}/scripts`),
    evals: await collectRelativeFiles(join(skillDir, "evals"), `${relativeDir}/evals`),
    evalManifest: await readSkillPackEvalManifest(join(skillDir, "evals", "evals.json"), `${relativeDir}/evals/evals.json`)
  };
}

/** Reads and summarizes the optional `evals/evals.json` manifest without running it. */
async function readSkillPackEvalManifest(
  path: string,
  relativePath: string
): Promise<SkillPackEvalManifestSummary | undefined> {
  const content = await readOptionalSkillFile(path);
  if (!content) {
    return undefined;
  }

  try {
    return summarizeSkillPackEvalManifest(relativePath, JSON.parse(content) as unknown);
  } catch {
    return { path: relativePath, valid: false, evalCount: 0, reason: "invalid JSON" };
  }
}

/** Validates the small eval manifest shape used by agent-ability style Skill Packs. */
function summarizeSkillPackEvalManifest(path: string, value: unknown): SkillPackEvalManifestSummary {
  if (!isRecord(value) || !Array.isArray(value.evals)) {
    return { path, valid: false, evalCount: 0, reason: "missing evals array" };
  }
  const unknownField = firstUnknownField(value, ["skill_name", "evals"]);
  if (unknownField) {
    return { path, valid: false, evalCount: value.evals.length, reason: `unknown manifest field ${unknownField}` };
  }
  if (!isNonEmptyString(value.skill_name)) {
    return { path, valid: false, evalCount: value.evals.length, reason: "missing skill_name" };
  }

  const invalidReason = summarizeSkillPackEvalCaseErrors(value.evals);
  return {
    path,
    valid: invalidReason === undefined,
    evalCount: value.evals.length,
    reason: invalidReason
  };
}

/** Summarizes all invalid eval cases while preserving the older single-error wording. */
function summarizeSkillPackEvalCaseErrors(values: unknown[]): string | undefined {
  const errors: string[] = [];
  const indexedErrors: string[] = [];
  for (const [index, value] of values.entries()) {
    const reason = summarizeSkillPackEvalCase(value);
    if (reason) {
      errors.push(reason);
      indexedErrors.push(formatIndexedSkillPackEvalCaseError(reason, index));
    }
  }

  if (errors.length === 0) {
    return undefined;
  }
  if (errors.length === 1) {
    return errors[0];
  }
  return `multiple eval case errors: ${indexedErrors.join("; ")}`;
}

/** Adds the eval case number to an error reason when several case errors are shown together. */
function formatIndexedSkillPackEvalCaseError(reason: string, index: number): string {
  return `eval ${index + 1} ${reason.replace(/^eval case\s+/, "")}`;
}

/** Returns why an eval case is invalid, or nothing when it matches the local schema subset. */
function summarizeSkillPackEvalCase(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return "eval case must be an object";
  }
  const unknownField = firstUnknownField(value, ["id", "prompt", "expected_output", "files", "grader"]);
  if (unknownField) {
    return `unknown eval field ${unknownField}`;
  }
  if (
    (typeof value.id !== "string" && typeof value.id !== "number") ||
    typeof value.prompt !== "string" ||
    typeof value.expected_output !== "string"
  ) {
    return "eval case requires id, prompt, expected_output, and supported grader";
  }
  if (!skillPackEvalRequiredFieldsAreNonEmpty(value)) {
    return "eval case requires non-empty id, prompt, and expected_output";
  }
  if (!skillPackEvalFilesAreValid(value.files)) {
    return "eval case files must be an array of strings";
  }
  return summarizeSkillPackEvalGrader(value.grader);
}

/** Checks required eval text fields against the schema's minLength rule. */
function skillPackEvalRequiredFieldsAreNonEmpty(value: Record<string, unknown>): boolean {
  return skillPackEvalIdIsNonEmpty(value.id) && isNonEmptyString(value.prompt) && isNonEmptyString(value.expected_output);
}

/** Allows numeric eval ids while rejecting blank string ids. */
function skillPackEvalIdIsNonEmpty(value: unknown): boolean {
  return typeof value === "number" || isNonEmptyString(value);
}

/** Checks optional fixture file declarations without loading the files during discovery. */
function skillPackEvalFilesAreValid(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((file) => typeof file === "string"));
}

/** Returns why an optional deterministic grader is invalid, or nothing when it is usable. */
function summarizeSkillPackEvalGrader(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value) || typeof value.type !== "string") {
    return "eval case requires id, prompt, expected_output, and supported grader";
  }
  if (value.type === "contains") {
    const unknownField = firstUnknownField(value, ["type"]);
    return unknownField ? `unknown grader field ${unknownField}` : undefined;
  }
  if (value.type === "regex") {
    const unknownField = firstUnknownField(value, ["type", "pattern"]);
    if (unknownField) {
      return `unknown grader field ${unknownField}`;
    }
    if (typeof value.pattern !== "string" || value.pattern.length === 0) {
      return "regex grader pattern must be a non-empty string";
    }
    return regexPatternIsValid(value.pattern) ? undefined : "regex grader pattern is invalid";
  }
  if (value.type === "model_judge") {
    const unknownField = firstUnknownField(value, ["type", "rubric", "judge_runs", "pass_threshold"]);
    if (unknownField) {
      return `unknown grader field ${unknownField}`;
    }
    if (!isNonEmptyString(value.rubric)) {
      return "model_judge rubric must be a non-empty string";
    }
    if (!modelJudgePositiveIntegerIsValid(value.judge_runs)) {
      return "model_judge judge_runs must be an integer from 1 to 5";
    }
    if (!modelJudgePositiveIntegerIsValid(value.pass_threshold)) {
      return "model_judge pass_threshold must be an integer from 1 to 5";
    }
    const judgeRuns = typeof value.judge_runs === "number" ? value.judge_runs : 1;
    const passThreshold = typeof value.pass_threshold === "number" ? value.pass_threshold : judgeRuns;
    return passThreshold <= judgeRuns ? undefined : "model_judge pass_threshold must be less than or equal to judge_runs";
  }
  if (value.type === "tool_trace") {
    const unknownField = firstUnknownField(value, [
      "type",
      "tool",
      "input_contains",
      "input_matches",
      "input_schema",
      "output_contains",
      "output_matches",
      "output_type",
      "output_schema"
    ]);
    if (unknownField) {
      return `unknown grader field ${unknownField}`;
    }
    if (!isNonEmptyString(value.tool)) {
      return "tool_trace grader tool must be a non-empty string";
    }
    if (value.input_contains !== undefined && !isNonEmptyString(value.input_contains)) {
      return "tool_trace input_contains must be a non-empty string";
    }
    if (value.input_matches !== undefined && !isNonEmptyRecord(value.input_matches)) {
      return "tool_trace input_matches must be a non-empty object";
    }
    const inputSchemaReason = summarizeOptionalJsonSchema(value.input_schema, "input_schema");
    if (inputSchemaReason) {
      return inputSchemaReason;
    }
    if (value.output_contains !== undefined && !isNonEmptyString(value.output_contains)) {
      return "tool_trace output_contains must be a non-empty string";
    }
    if (value.output_matches !== undefined && !isNonEmptyRecord(value.output_matches)) {
      return "tool_trace output_matches must be a non-empty object";
    }
    if (value.output_type !== undefined && !isTraceValueType(value.output_type)) {
      return "tool_trace output_type must be a supported JSON value type";
    }
    const outputSchemaReason = summarizeOptionalJsonSchema(value.output_schema, "output_schema");
    if (outputSchemaReason) {
      return outputSchemaReason;
    }
    return undefined;
  }
  return "eval case requires id, prompt, expected_output, and supported grader";
}

/** Checks optional repeated model judge settings without running the eval case. */
function modelJudgePositiveIntegerIsValid(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5);
}

/** Summarizes optional compact JSON Schema-style grader declarations without running an eval case. */
function summarizeOptionalJsonSchema(value: unknown, field: "input_schema" | "output_schema"): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const result = validateJsonSchemaDeclaration(value);
  return result.valid ? undefined : `tool_trace ${field} is invalid: ${result.reason ?? "schema must be valid"}`;
}

/** Validates a regex pattern without executing an eval case. */
function regexPatternIsValid(pattern: string): boolean {
  try {
    new RegExp(pattern, "iu");
    return true;
  } catch {
    return false;
  }
}

/** Recursively lists files under an optional resource directory using workspace-relative paths. */
async function collectRelativeFiles(directory: string, relativeDirectory: string): Promise<string[]> {
  const entries = await readDirectoryIfPresent(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(absolutePath, relativePath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

/** Reads a directory and treats a missing skills directory as an empty catalog. */
async function readDirectoryIfPresent(path: string): Promise<Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

/** Reads a candidate Skill file and ignores directories that do not contain one. */
async function readOptionalSkillFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Parses the small frontmatter subset used by Codex-style `SKILL.md` files. */
function parseSkillPackSummary(
  path: string,
  content: string
): Pick<SkillPackVariantSummary, "name" | "description" | "path" | "version"> {
  const frontmatter = parseSkillFrontmatter(content);
  return {
    name: frontmatter.get("name") ?? fallbackSkillName(path),
    description: frontmatter.get("description") ?? "",
    path,
    version: frontmatter.get("version")
  };
}

/** Extracts `key: value` frontmatter until the closing marker. */
function parseSkillFrontmatter(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  if (!content.startsWith("---")) {
    return fields;
  }

  const lines = content.split(/\r?\n/);
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "---") {
      break;
    }

    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (field) {
      fields.set(field[1].toLowerCase(), stripYamlQuotes(field[2]));
    }
  }
  return fields;
}

/** Removes simple wrapping quotes from frontmatter values. */
function stripYamlQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

/** Falls back to the directory name when a Skill Pack has no frontmatter name. */
function fallbackSkillName(path: string): string {
  return path.split("/").at(-2) ?? path;
}

/** Normalizes names so `docs-helper`, `docs helper`, and `docs_helper` compare the same way. */
function normalizeSkillPackMention(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Scores one Skill Pack by counting unique query terms in name and description. */
function scoreSkillPack(skillPack: SkillPackSummary, queryTerms: Set<string>): number {
  let score = 0;
  const matched = new Set<string>();
  for (const term of extractSkillPackTerms(`${skillPack.name} ${skillPack.description}`)) {
    if (queryTerms.has(term) && !matched.has(term)) {
      matched.add(term);
      score += 1;
    }
  }
  return score;
}

/** Extracts keyword-like terms for the MVP Skill Pack matcher. */
function extractSkillPackTerms(value: string): Set<string> {
  const terms = new Set<string>();
  const words = value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words) {
    if (word.length >= 2 && !skillPackStopWords.has(word)) {
      terms.add(word);
    }
  }
  return terms;
}

/** Formats selected Skill Packs as visible provider context. */
export function formatSkillPackContext(
  skillPacks: SkillPackSummary[],
  guidance: SkillPackGuidanceMap = new Map()
): string {
  if (skillPacks.length === 0) {
    return "";
  }

  const lines = ["# Relevant Skill Packs", "", "_Filtered to skills relevant to the current task._"];
  for (const skillPack of skillPacks) {
    lines.push(
      "",
      `## ${skillPack.name}`,
      "",
      `- path: ${skillPack.path}`,
      `- source: ${skillPack.source.label} (priority ${skillPack.source.priority})`,
      `- source root: ${skillPack.source.root}`
    );
    if (skillPack.version) {
      lines.push(`- version: ${skillPack.version}`);
    }
    if (skillPack.description.length > 0) {
      lines.push(`- description: ${skillPack.description}`);
    }
    lines.push(...formatSkillPackSelection(skillPack.selection));
    lines.push(...formatSkillPackConflicts(skillPack.conflicts));
    lines.push(...formatSkillPackResourceInventory(skillPack.resources));
    lines.push(...formatSkillPackGuidance(skillPack, guidance));
  }
  return `${lines.join("\n")}\n`;
}

/** Formats same-name source alternatives without assuming the normal winner was selected. */
function formatSkillPackConflicts(conflicts: SkillPackVariantSummary[] | undefined): string[] {
  if (!conflicts || conflicts.length === 0) {
    return [];
  }
  return [
    `- source variants: ${conflicts.length} alternative${conflicts.length === 1 ? "" : "s"}`,
    ...conflicts.map((conflict) => {
      const version = conflict.version ? `, version ${conflict.version}` : "";
      return `  - ${conflict.source.label} (priority ${conflict.source.priority}${version}): ${conflict.path}`;
    })
  ];
}

/** Formats explicit selection metadata before the selected guidance body. */
function formatSkillPackSelection(selection: SkillPackSelectionMetadata | undefined): string[] {
  if (!selection) {
    return [];
  }
  return [
    `- selection: explicit (--skill ${selection.selector})`,
    `- source precedence overridden: ${selection.precedenceOverridden ? "yes" : "no"}`
  ];
}

/** Appends the complete selected `SKILL.md` content with its audit digest. */
function formatSkillPackGuidance(
  skillPack: SkillPackSummary,
  guidance: SkillPackGuidanceMap
): string[] {
  const loaded = guidance.get(skillPack.path);
  if (!loaded) {
    return [];
  }
  return [
    `- guidance: full SKILL.md (${loaded.bytes} bytes, sha256 ${loaded.sha256})`,
    "",
    "### Full SKILL.md Guidance",
    "",
    `--- BEGIN SKILL PACK GUIDANCE ${loaded.sha256} ---`,
    loaded.content.trimEnd(),
    `--- END SKILL PACK GUIDANCE ${loaded.sha256} ---`
  ];
}

/** Formats optional Skill Pack resources as inventory hints rather than executable actions. */
function formatSkillPackResourceInventory(resources: SkillPackResources | undefined): string[] {
  if (!resources || countSkillPackResources(resources) === 0) {
    return [];
  }

  const lines = ["- resource inventory:"];
  if (resources.scripts.length > 0) {
    // Script paths are guidance only; actual execution still goes through Local Tools and confirmations.
    lines.push("  - scripts are inventory only and are not auto-executed by the Skill Pack layer");
  }
  for (const [label, paths] of [
    ["references", resources.references],
    ["scripts", resources.scripts],
    ["evals", resources.evals]
  ] as const) {
    for (const path of paths) {
      lines.push(`  - ${label}: ${path}`);
    }
  }
  if (resources.evalManifest) {
    lines.push(`  - eval manifest: ${formatEvalManifestSummary(resources.evalManifest)}`);
  }
  return lines;
}

/** Formats eval manifest validity and count for provider context. */
function formatEvalManifestSummary(summary: SkillPackEvalManifestSummary): string {
  const countLabel = summary.evalCount === 1 ? "eval" : "evals";
  if (summary.valid) {
    return `valid (${summary.evalCount} ${countLabel})`;
  }
  return `invalid (${summary.reason ?? "unknown reason"})`;
}

/** Counts resource files across the agent-ability style resource buckets. */
function countSkillPackResources(resources: SkillPackResources): number {
  return resources.references.length + resources.scripts.length + resources.evals.length;
}

/** Finds the first JSON object property outside a schema field allowlist. */
function firstUnknownField(value: Record<string, unknown>, allowedFields: string[]): string | undefined {
  const allowed = new Set(allowedFields);
  return Object.keys(value).find((field) => !allowed.has(field));
}

/** Treats missing paths and non-directory Skill candidates as absent catalog entries. */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

/** Checks whether a value can be safely inspected as a record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks that an eval matcher object contains at least one expected field. */
function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}

/** Checks non-empty strings used by optional Skill Pack eval manifests. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Checks output_type declarations against the supported JSON-style value types. */
function isTraceValueType(value: unknown): boolean {
  return isJsonValueType(value);
}
