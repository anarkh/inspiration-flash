import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { runTask } from "../agent/runner.ts";
import { parseAgentStep } from "../core/agent-step.ts";
import type { ModelProvider } from "../model/provider.ts";
import { ensureWorkspaceState, readRunEvents, type TaskMode } from "../state/store.ts";
import type { ConfirmationRequired, ConfirmationResponse } from "../tools/local-tools.ts";
import {
  isJsonValueType,
  jsonValueMatchesSchema,
  jsonValueTypeOf,
  validateJsonSchemaDeclaration,
  type JsonSchema,
  type JsonValueType
} from "./json-schema.ts";
import { discoverWorkspaceSkillPacks, type SkillPackSummary } from "./skill-packs.ts";

export interface RunSkillPackEvalsInput {
  workspace: string;
  skillPack: string;
  provider: ModelProvider;
  mode?: TaskMode;
  logStep?: (message: string) => void;
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
}

export interface SkillPackEvalCaseResult {
  id: string;
  prompt: string;
  expectedOutput: string;
  grader: SkillPackEvalGrader["type"];
  status: "passed" | "failed";
  reason?: string;
  judge?: SkillPackEvalJudgeResult;
  taskRunId?: string;
  taskRunDir?: string;
  reportPath?: string;
}

/** Captures every model_judge call so a semantic eval can be audited after the run. */
export interface SkillPackEvalJudgeResult {
  runs: number;
  passThreshold: number;
  passedCount: number;
  verdicts: SkillPackEvalJudgeVerdict[];
}

/** Normalizes model judge output into stable result values, including malformed judge responses. */
export interface SkillPackEvalJudgeVerdict {
  verdict: "pass" | "fail" | "invalid";
  reason?: string;
}

export interface SkillPackEvalRunResult {
  status: "completed";
  skillPack: SkillPackSummary;
  manifestPath: string;
  reportPath: string;
  resultsPath: string;
  passedCount: number;
  failedCount: number;
  cases: SkillPackEvalCaseResult[];
}

interface SkillPackEvalCase {
  id: string;
  prompt: string;
  expectedOutput: string;
  grader: SkillPackEvalGrader;
  files: string[];
}

interface SkillPackEvalManifest {
  skillName: string;
  cases: SkillPackEvalCase[];
}

/** Internal grader result shared by deterministic graders and semantic model_judge graders. */
interface SkillPackEvalCaseEvaluation {
  passed: boolean;
  reason?: string;
  judge?: SkillPackEvalJudgeResult;
}

/** Internal result for one model_judge call before repeated-run threshold aggregation. */
interface ModelJudgeRunEvaluation {
  passed: boolean;
  verdict: SkillPackEvalJudgeVerdict;
}

type SkillPackEvalGrader =
  | { type: "contains" }
  | { type: "regex"; pattern: string }
  | { type: "model_judge"; rubric: string; judgeRuns: number; passThreshold: number }
  | {
      type: "tool_trace";
      tool: string;
      inputContains?: string;
      inputMatches?: Record<string, unknown>;
      inputSchema?: JsonSchema;
      outputContains?: string;
      outputMatches?: Record<string, unknown>;
      outputType?: JsonValueType;
      outputSchema?: JsonSchema;
    };

/** Runs a Skill Pack's local eval manifest through the normal Task Run loop. */
export async function runSkillPackEvals(input: RunSkillPackEvalsInput): Promise<SkillPackEvalRunResult> {
  const skillPack = await resolveSkillPackForEval(input.workspace, input.skillPack);
  const manifestPath = manifestPathForSkillPack(skillPack);
  const manifest = parseSkillPackEvalManifest(
    await readFile(join(input.workspace, manifestPath), "utf8"),
    manifestPath
  );
  const evalDir = await createSkillPackEvalOutputDir(input.workspace, skillPack.name);
  const cases: SkillPackEvalCaseResult[] = [];

  for (const evalCase of manifest.cases) {
    cases.push(
      await runOneSkillPackEvalCase({
        ...input,
        mode: input.mode ?? "advisory",
        skillPack,
        evalCase
      })
    );
  }

  const passedCount = cases.filter((evalCase) => evalCase.status === "passed").length;
  const failedCount = cases.length - passedCount;
  const reportPath = join(evalDir, "report.md");
  const resultsPath = join(evalDir, "results.json");
  const result: SkillPackEvalRunResult = {
    status: "completed",
    skillPack,
    manifestPath,
    reportPath,
    resultsPath,
    passedCount,
    failedCount,
    cases
  };

  await writeFile(reportPath, formatSkillPackEvalReport(result));
  await writeFile(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

interface RunOneSkillPackEvalCaseInput extends Omit<RunSkillPackEvalsInput, "skillPack" | "mode"> {
  mode: TaskMode;
  skillPack: SkillPackSummary;
  evalCase: SkillPackEvalCase;
}

/** Executes one eval case and checks its final report with the declared grader. */
async function runOneSkillPackEvalCase(input: RunOneSkillPackEvalCaseInput): Promise<SkillPackEvalCaseResult> {
  try {
    const run = await runTask({
      workspace: input.workspace,
      goal: formatSkillPackEvalGoal(input.skillPack, input.evalCase),
      mode: input.mode,
      successCheck: formatSkillPackEvalSuccessCheck(input.evalCase),
      provider: input.provider,
      logStep: input.logStep,
      confirmAction: createEvalConfirmationHandler(input.skillPack, input.confirmAction)
    });
    const reportPath = join(run.runDir, "report.md");
    const report = await readFile(reportPath, "utf8");
    const events = await readRunEvents(run.runDir);
    const evaluation = await evaluateSkillPackEvalCase({
      report,
      events,
      evalCase: input.evalCase,
      provider: input.provider,
      mode: input.mode
    });
    return {
      id: input.evalCase.id,
      prompt: input.evalCase.prompt,
      expectedOutput: input.evalCase.expectedOutput,
      grader: input.evalCase.grader.type,
      status: evaluation.passed ? "passed" : "failed",
      reason: evaluation.reason,
      judge: evaluation.judge,
      taskRunId: run.id,
      taskRunDir: run.runDir,
      reportPath
    };
  } catch (error) {
    return {
      id: input.evalCase.id,
      prompt: input.evalCase.prompt,
      expectedOutput: input.evalCase.expectedOutput,
      grader: input.evalCase.grader.type,
      status: "failed",
      reason: error instanceof Error ? error.message : "unknown eval execution error"
    };
  }
}

/** Formats the Success Check so Task Run metadata names the active grader. */
function formatSkillPackEvalSuccessCheck(evalCase: SkillPackEvalCase): string {
  if (evalCase.grader.type === "contains") {
    return `Final report includes expected output marker: ${evalCase.expectedOutput}`;
  }
  if (evalCase.grader.type === "regex") {
    return `Final report matches regex grader: ${evalCase.grader.pattern}`;
  }
  if (evalCase.grader.type === "model_judge") {
    return `Final report satisfies model judge rubric: ${evalCase.grader.rubric}`;
  }
  if (evalCase.grader.inputMatches) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with matching structured input`;
  }
  if (evalCase.grader.inputSchema) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with input matching schema`;
  }
  if (evalCase.grader.inputContains) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with input containing: ${evalCase.grader.inputContains}`;
  }
  if (evalCase.grader.outputContains) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with output containing: ${evalCase.grader.outputContains}`;
  }
  if (evalCase.grader.outputMatches) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with matching structured output`;
  }
  if (evalCase.grader.outputType) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with output type: ${evalCase.grader.outputType}`;
  }
  if (evalCase.grader.outputSchema) {
    return `Task Run trace includes Local Tool ${evalCase.grader.tool} with output matching schema`;
  }
  return `Task Run trace includes Local Tool: ${evalCase.grader.tool}`;
}

/** Resolves a Skill Pack by frontmatter name, directory name, or workspace-relative SKILL.md path. */
async function resolveSkillPackForEval(workspace: string, target: string): Promise<SkillPackSummary> {
  const skillPacks = await discoverWorkspaceSkillPacks(workspace);
  const normalizedTarget = normalizeSkillPackTarget(target);
  const match = skillPacks.find((skillPack) => {
    const directoryName = basename(dirname(skillPack.path));
    return [skillPack.name, directoryName, dirname(skillPack.path), skillPack.path].some(
      (candidate) => normalizeSkillPackTarget(candidate) === normalizedTarget
    );
  });
  if (!match) {
    throw new Error(`Skill Pack not found: ${target}`);
  }
  return match;
}

/** Derives the conventional eval manifest path from a selected Skill Pack path. */
function manifestPathForSkillPack(skillPack: SkillPackSummary): string {
  return `${dirname(skillPack.path)}/evals/evals.json`;
}

/** Parses the local eval manifest shape used by agent-ability style Skill Packs. */
function parseSkillPackEvalManifest(content: string, path: string): SkillPackEvalManifest {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.evals)) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: missing evals array`);
  }
  assertKnownFields(parsed, ["skill_name", "evals"], `Invalid Skill Pack eval manifest ${path}: unknown manifest field`);
  if (!isNonEmptyString(parsed.skill_name)) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: missing skill_name`);
  }

  return {
    skillName: parsed.skill_name,
    cases: parseSkillPackEvalCases(parsed.evals, path)
  };
}

/** Parses every eval case first so invalid manifests can report more than one case error at once. */
function parseSkillPackEvalCases(values: unknown[], path: string): SkillPackEvalCase[] {
  const cases: SkillPackEvalCase[] = [];
  const errors: string[] = [];
  for (const [index, value] of values.entries()) {
    try {
      cases.push(parseSkillPackEvalCase(value, index, path));
    } catch (error) {
      errors.push(formatSkillPackEvalCaseParseError(error, path));
    }
  }

  if (errors.length === 1) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: ${errors[0]}`);
  }
  if (errors.length > 1) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: multiple eval case errors: ${errors.join("; ")}`);
  }
  return cases;
}

/** Removes the repeated manifest prefix before several eval case errors are combined. */
function formatSkillPackEvalCaseParseError(error: unknown, path: string): string {
  const message = error instanceof Error ? error.message : "unknown eval case error";
  const prefix = `Invalid Skill Pack eval manifest ${path}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/** Parses one eval case and keeps validation errors tied to the manifest path. */
function parseSkillPackEvalCase(value: unknown, index: number, path: string): SkillPackEvalCase {
  if (!isRecord(value)) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} must be an object`);
  }
  assertKnownFields(
    value,
    ["id", "prompt", "expected_output", "files", "grader"],
    `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unknown field`
  );
  if (typeof value.prompt !== "string" || typeof value.expected_output !== "string") {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} needs prompt and expected_output`);
  }
  if (typeof value.id !== "string" && typeof value.id !== "number") {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} needs id`);
  }
  if (!evalCaseRequiredFieldsAreNonEmpty(value)) {
    throw new Error(
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} requires non-empty id, prompt, and expected_output`
    );
  }

  return {
    id: String(value.id),
    prompt: value.prompt,
    expectedOutput: value.expected_output,
    grader: parseSkillPackEvalGrader(value.grader, index, path),
    files: parseSkillPackEvalFiles(value.files, index, path)
  };
}

/** Checks the schema minLength rule for required eval strings while allowing numeric ids. */
function evalCaseRequiredFieldsAreNonEmpty(value: Record<string, unknown>): boolean {
  return evalCaseIdIsNonEmpty(value.id) && isNonEmptyString(value.prompt) && isNonEmptyString(value.expected_output);
}

/** Treats numeric ids as valid and rejects blank string ids. */
function evalCaseIdIsNonEmpty(value: unknown): boolean {
  return typeof value === "number" || isNonEmptyString(value);
}

/** Parses optional fixture files while preserving the schema rule that every entry is a string path. */
function parseSkillPackEvalFiles(value: unknown, index: number, path: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((file): file is string => typeof file === "string")) {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} files must be an array of strings`);
  }
  return value;
}

/** Parses the optional deterministic grader declaration for one eval case. */
function parseSkillPackEvalGrader(value: unknown, index: number, path: string): SkillPackEvalGrader {
  if (value === undefined) {
    return { type: "contains" };
  }
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unsupported grader`);
  }
  if (value.type === "contains") {
    assertKnownFields(
      value,
      ["type"],
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unknown grader field`
    );
    return { type: "contains" };
  }
  if (value.type === "regex") {
    assertKnownFields(
      value,
      ["type", "pattern"],
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unknown grader field`
    );
    if (typeof value.pattern !== "string" || value.pattern.length === 0) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} regex grader pattern must be a non-empty string`
      );
    }
    assertValidRegexPattern(value.pattern, index, path);
    return { type: "regex", pattern: value.pattern };
  }
  if (value.type === "model_judge") {
    assertKnownFields(
      value,
      ["type", "rubric", "judge_runs", "pass_threshold"],
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unknown grader field`
    );
    if (!isNonEmptyString(value.rubric)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} model_judge rubric must be a non-empty string`
      );
    }
    const judgeRuns = parseModelJudgePositiveInteger(value.judge_runs, "judge_runs", index, path) ?? 1;
    const passThreshold = parseModelJudgePositiveInteger(value.pass_threshold, "pass_threshold", index, path) ?? judgeRuns;
    if (passThreshold > judgeRuns) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} model_judge pass_threshold must be less than or equal to judge_runs`
      );
    }
    return { type: "model_judge", rubric: value.rubric, judgeRuns, passThreshold };
  }
  if (value.type === "tool_trace") {
    assertKnownFields(
      value,
      [
        "type",
        "tool",
        "input_contains",
        "input_matches",
        "input_schema",
        "output_contains",
        "output_matches",
        "output_type",
        "output_schema"
      ],
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unknown grader field`
    );
    if (!isNonEmptyString(value.tool)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace grader tool must be a non-empty string`
      );
    }
    if (value.input_contains !== undefined && !isNonEmptyString(value.input_contains)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace input_contains must be a non-empty string`
      );
    }
    if (value.input_matches !== undefined && !isNonEmptyRecord(value.input_matches)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace input_matches must be a non-empty object`
      );
    }
    const inputSchema = parseOptionalJsonSchema(value.input_schema, "input_schema", index, path);
    if (value.output_contains !== undefined && !isNonEmptyString(value.output_contains)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace output_contains must be a non-empty string`
      );
    }
    if (value.output_matches !== undefined && !isNonEmptyRecord(value.output_matches)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace output_matches must be a non-empty object`
      );
    }
    if (value.output_type !== undefined && !isTraceValueType(value.output_type)) {
      throw new Error(
        `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace output_type must be a supported JSON value type`
      );
    }
    const outputSchema = parseOptionalJsonSchema(value.output_schema, "output_schema", index, path);
    return {
      type: "tool_trace",
      tool: value.tool,
      inputContains: value.input_contains,
      inputMatches: value.input_matches,
      inputSchema,
      outputContains: value.output_contains,
      outputMatches: value.output_matches,
      outputType: value.output_type,
      outputSchema
    };
  }
  throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has unsupported grader`);
}

/** Parses optional positive integer settings for repeated model judge calibration. */
function parseModelJudgePositiveInteger(
  value: unknown,
  field: "judge_runs" | "pass_threshold",
  index: number,
  path: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} model_judge ${field} must be an integer from 1 to 5`
    );
  }
  return value;
}

/** Parses an optional compact JSON Schema-style matcher and reports manifest-friendly errors. */
function parseOptionalJsonSchema(
  value: unknown,
  field: "input_schema" | "output_schema",
  index: number,
  path: string
): JsonSchema | undefined {
  if (value === undefined) {
    return undefined;
  }
  const result = validateJsonSchemaDeclaration(value);
  if (!result.valid || !isNonEmptyRecord(value)) {
    throw new Error(
      `Invalid Skill Pack eval manifest ${path}: eval ${index + 1} tool_trace ${field} is invalid: ${result.reason ?? "schema must be a non-empty object"}`
    );
  }
  return value;
}

/** Creates the timestamped output directory for one Skill Pack eval run. */
async function createSkillPackEvalOutputDir(workspace: string, skillPackName: string): Promise<string> {
  const state = await ensureWorkspaceState(workspace);
  const path = join(state.stateDir, "evals", safePathSegment(skillPackName), createEvalRunId());
  await mkdir(path, { recursive: true });
  return path;
}

/** Builds the actual Agent task used to exercise one eval case. */
function formatSkillPackEvalGoal(skillPack: SkillPackSummary, evalCase: SkillPackEvalCase): string {
  return [
    `Use ${skillPack.name} Skill Pack to run eval ${evalCase.id}.`,
    "",
    evalCase.prompt,
    "",
    `Expected output marker: ${evalCase.expectedOutput}`,
    `Grader: ${formatSkillPackEvalGrader(evalCase.grader)}`
  ].join("\n");
}

/** Auto-selects the evaluated Skill Pack while delegating non-Skill confirmations to the caller. */
function createEvalConfirmationHandler(
  skillPack: SkillPackSummary,
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse
): (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse {
  return (request) => {
    if (request.tool === "skill_packs") {
      return { approved: true, selected: [skillPack.path] };
    }
    return confirmAction ? confirmAction(request) : false;
  };
}

/** Checks one eval case using either final-report text or durable Task Run events. */
interface EvaluateSkillPackEvalCaseInput {
  report: string,
  events: unknown[],
  evalCase: SkillPackEvalCase,
  provider: ModelProvider,
  mode: TaskMode
}

/** Checks one eval case using final-report text, durable Task Run events, or a model judge. */
async function evaluateSkillPackEvalCase(
  input: EvaluateSkillPackEvalCaseInput
): Promise<SkillPackEvalCaseEvaluation> {
  const { report, events, evalCase } = input;
  if (evalCase.grader.type === "contains") {
    return normalizedIncludes(report, evalCase.expectedOutput)
      ? { passed: true }
      : { passed: false, reason: "expected output not found in Task Report" };
  }
  if (evalCase.grader.type === "tool_trace") {
    return evaluateToolTraceGrader(events, evalCase.grader);
  }
  if (evalCase.grader.type === "model_judge") {
    return evaluateModelJudgeGrader(input.provider, input.mode, evalCase, report, evalCase.grader);
  }

  return new RegExp(evalCase.grader.pattern, "iu").test(report)
    ? { passed: true }
    : { passed: false, reason: "regex grader did not match Task Report" };
}

/** Asks the configured model provider to judge a final report against the eval rubric. */
async function evaluateModelJudgeGrader(
  provider: ModelProvider,
  mode: TaskMode,
  evalCase: SkillPackEvalCase,
  report: string,
  grader: Extract<SkillPackEvalGrader, { type: "model_judge" }>
): Promise<SkillPackEvalCaseEvaluation> {
  let passedCount = 0;
  const failureReasons: string[] = [];
  const verdicts: SkillPackEvalJudgeVerdict[] = [];
  for (let run = 1; run <= grader.judgeRuns; run++) {
    const result = await evaluateOneModelJudgeRun(provider, mode, evalCase, report, grader, run);
    verdicts.push(result.verdict);
    if (result.passed) {
      passedCount += 1;
    } else if (result.verdict.reason) {
      failureReasons.push(result.verdict.reason);
    }
  }

  const judge = {
    runs: grader.judgeRuns,
    passThreshold: grader.passThreshold,
    passedCount,
    verdicts
  };
  if (passedCount >= grader.passThreshold) {
    return { passed: true, judge };
  }
  if (grader.judgeRuns === 1 && failureReasons[0]) {
    return { passed: false, reason: failureReasons[0], judge };
  }
  const failureDetail = failureReasons.length > 0 ? `: ${failureReasons.join("; ")}` : "";
  return {
    passed: false,
    reason: `model_judge passed ${passedCount}/${grader.judgeRuns} below threshold ${grader.passThreshold}${failureDetail}`,
    judge
  };
}

/** Runs one model judge request and normalizes its verdict into a pass/fail result. */
async function evaluateOneModelJudgeRun(
  provider: ModelProvider,
  mode: TaskMode,
  evalCase: SkillPackEvalCase,
  report: string,
  grader: Extract<SkillPackEvalGrader, { type: "model_judge" }>,
  run: number
): Promise<ModelJudgeRunEvaluation> {
  const step = parseAgentStep(
    await provider.nextStep({
      goal: formatModelJudgeGoal(evalCase, report, grader, run),
      mode,
      interaction: "task",
      successCheck: "Return a model_judge JSON verdict",
      turn: 1,
      events: []
    })
  );
  if (step.type !== "finish") {
    return {
      passed: false,
      verdict: { verdict: "invalid", reason: `model_judge returned ${step.type} instead of finish` }
    };
  }

  const verdict = parseModelJudgeVerdict(step.report);
  if (!verdict.valid) {
    return { passed: false, verdict: { verdict: "invalid", reason: verdict.reason } };
  }
  if (verdict.verdict === "pass") {
    return { passed: true, verdict: { verdict: "pass", reason: verdict.reason } };
  }
  return {
    passed: false,
    verdict: { verdict: "fail", reason: verdict.reason ?? "model_judge returned fail" }
  };
}

/** Builds a narrow judging prompt that asks for a machine-readable pass/fail verdict only. */
function formatModelJudgeGoal(
  evalCase: SkillPackEvalCase,
  report: string,
  grader: Extract<SkillPackEvalGrader, { type: "model_judge" }>,
  run: number
): string {
  return [
    "Judge Skill Pack eval case result.",
    "",
    "Evaluate whether the Task Report satisfies the rubric.",
    "Return exactly one JSON object with this shape:",
    '{"verdict":"pass"|"fail","reason":"short reason"}',
    "",
    `Eval id: ${evalCase.id}`,
    `Judge run: ${run} of ${grader.judgeRuns}`,
    `Pass threshold: ${grader.passThreshold} of ${grader.judgeRuns}`,
    "",
    "Prompt:",
    evalCase.prompt,
    "",
    "Expected output note:",
    evalCase.expectedOutput,
    "",
    "Rubric:",
    grader.rubric,
    "",
    "Task Report:",
    report
  ].join("\n");
}

type ModelJudgeVerdict =
  | { valid: true; verdict: "pass" | "fail"; reason?: string }
  | { valid: false; reason: string };

/** Parses the model judge's final report as a strict JSON pass/fail verdict. */
function parseModelJudgeVerdict(report: string): ModelJudgeVerdict {
  const parsed = parseJsonObjectFromReport(report);
  if (!isRecord(parsed)) {
    return { valid: false, reason: "model_judge did not return a JSON object verdict" };
  }
  if (parsed.verdict !== "pass" && parsed.verdict !== "fail") {
    return { valid: false, reason: "model_judge verdict must be pass or fail" };
  }
  if (parsed.reason !== undefined && typeof parsed.reason !== "string") {
    return { valid: false, reason: "model_judge reason must be a string" };
  }
  return { valid: true, verdict: parsed.verdict, reason: parsed.reason };
}

/** Extracts a JSON object from a report, accepting plain JSON or fenced/narrated model output. */
function parseJsonObjectFromReport(report: string): unknown {
  try {
    return JSON.parse(report);
  } catch {
    try {
      const objectMatch = report.match(/\{[\s\S]*\}/);
      return objectMatch ? JSON.parse(objectMatch[0]) : undefined;
    } catch {
      return undefined;
    }
  }
}

/** Checks a tool_trace grader against durable Task Run events. */
function evaluateToolTraceGrader(
  events: unknown[],
  grader: Extract<SkillPackEvalGrader, { type: "tool_trace" }>
): { passed: boolean; reason?: string } {
  if (!taskRunEventsIncludeTool(events, grader.tool)) {
    return { passed: false, reason: `tool ${grader.tool} not found in Task Run trace` };
  }
  if (grader.inputContains && !taskRunToolInputIncludes(events, grader.tool, grader.inputContains)) {
    return { passed: false, reason: `tool ${grader.tool} input did not include ${grader.inputContains}` };
  }
  if (grader.inputMatches && !taskRunToolInputMatches(events, grader.tool, grader.inputMatches)) {
    return { passed: false, reason: `tool ${grader.tool} input did not match ${JSON.stringify(grader.inputMatches)}` };
  }
  if (grader.inputSchema && !taskRunToolInputMatchesSchema(events, grader.tool, grader.inputSchema)) {
    return { passed: false, reason: `tool ${grader.tool} input did not match schema` };
  }
  if (grader.outputContains && !taskRunToolOutputIncludes(events, grader.tool, grader.outputContains)) {
    return { passed: false, reason: `tool ${grader.tool} output did not include ${grader.outputContains}` };
  }
  if (grader.outputMatches && !taskRunToolOutputMatches(events, grader.tool, grader.outputMatches)) {
    return { passed: false, reason: `tool ${grader.tool} output did not match ${JSON.stringify(grader.outputMatches)}` };
  }
  if (grader.outputType && !taskRunToolOutputHasType(events, grader.tool, grader.outputType)) {
    return { passed: false, reason: `tool ${grader.tool} output type was not ${grader.outputType}` };
  }
  if (grader.outputSchema && !taskRunToolOutputMatchesSchema(events, grader.tool, grader.outputSchema)) {
    return { passed: false, reason: `tool ${grader.tool} output did not match schema` };
  }
  return { passed: true };
}

/** Looks for a Local Tool call or observation in a Task Run's durable events. */
function taskRunEventsIncludeTool(events: unknown[], tool: string): boolean {
  return events.some(
    (event) => isRecord(event) && (event.type === "tool" || event.type === "tool_result") && event.tool === tool
  );
}

/** Checks tool call inputs, not observations, because only call events carry the model-provided arguments. */
function taskRunToolInputIncludes(events: unknown[], tool: string, expectedInputFragment: string): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool" || event.tool !== tool) {
      return false;
    }
    return normalizedIncludes(stringifyTraceValue(event.input), expectedInputFragment);
  });
}

/** Checks tool call inputs with a partial JSON-object matcher. */
function taskRunToolInputMatches(events: unknown[], tool: string, expectedInput: Record<string, unknown>): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool" || event.tool !== tool) {
      return false;
    }
    return jsonValueIncludes(event.input, expectedInput);
  });
}

/** Checks tool call inputs with the compact JSON Schema-style matcher. */
function taskRunToolInputMatchesSchema(events: unknown[], tool: string, schema: JsonSchema): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool" || event.tool !== tool) {
      return false;
    }
    return jsonValueMatchesSchema(event.input, schema).valid;
  });
}

/** Checks tool observations because output constraints validate what the tool actually returned. */
function taskRunToolOutputIncludes(events: unknown[], tool: string, expectedOutputFragment: string): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool_result" || event.tool !== tool) {
      return false;
    }
    return normalizedIncludes(stringifyTraceValue(event.output), expectedOutputFragment);
  });
}

/** Checks tool observations with a partial JSON-object matcher. */
function taskRunToolOutputMatches(events: unknown[], tool: string, expectedOutput: Record<string, unknown>): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool_result" || event.tool !== tool) {
      return false;
    }
    return jsonValueIncludes(event.output, expectedOutput);
  });
}

/** Checks the top-level JSON-ish type of a tool observation. */
function taskRunToolOutputHasType(events: unknown[], tool: string, expectedType: JsonValueType): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool_result" || event.tool !== tool) {
      return false;
    }
    return jsonValueTypeOf(event.output) === expectedType;
  });
}

/** Checks tool observations with the compact JSON Schema-style matcher. */
function taskRunToolOutputMatchesSchema(events: unknown[], tool: string, schema: JsonSchema): boolean {
  return events.some((event) => {
    if (!isRecord(event) || event.type !== "tool_result" || event.tool !== tool) {
      return false;
    }
    return jsonValueMatchesSchema(event.output, schema).valid;
  });
}

/** Serializes trace values so evals can match objects, arrays, and strings without learning event internals. */
function stringifyTraceValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

/** Returns true when `actual` contains every field and value from `expected`. */
function jsonValueIncludes(actual: unknown, expected: unknown): boolean {
  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return false;
    }
    return Object.entries(expected).every(([key, value]) => jsonValueIncludes(actual[key], value));
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.length === actual.length && expected.every((value, index) => jsonValueIncludes(actual[index], value));
  }
  return Object.is(actual, expected);
}

/** Checks expected output using Unicode normalization and case folding. */
function normalizedIncludes(report: string, expectedOutput: string): boolean {
  return report.normalize("NFKC").toLowerCase().includes(expectedOutput.normalize("NFKC").toLowerCase());
}

/** Validates regex grader patterns while parsing the manifest. */
function assertValidRegexPattern(pattern: string, index: number, path: string): void {
  try {
    new RegExp(pattern, "iu");
  } catch {
    throw new Error(`Invalid Skill Pack eval manifest ${path}: eval ${index + 1} has invalid regex grader`);
  }
}

/** Formats a grader declaration for prompts and reports. */
function formatSkillPackEvalGrader(grader: SkillPackEvalGrader): string {
  if (grader.type === "contains") {
    return "contains(expected_output)";
  }
  if (grader.type === "regex") {
    return `regex(${grader.pattern})`;
  }
  if (grader.type === "model_judge") {
    return `model_judge(rubric=${grader.rubric}, judge_runs=${grader.judgeRuns}, pass_threshold=${grader.passThreshold})`;
  }
  if (grader.inputMatches) {
    return `tool_trace(${grader.tool}, input_matches=${JSON.stringify(grader.inputMatches)})`;
  }
  if (grader.inputSchema) {
    return `tool_trace(${grader.tool}, input_schema=${JSON.stringify(grader.inputSchema)})`;
  }
  if (grader.outputContains) {
    return `tool_trace(${grader.tool}, output_contains=${grader.outputContains})`;
  }
  if (grader.outputMatches) {
    return `tool_trace(${grader.tool}, output_matches=${JSON.stringify(grader.outputMatches)})`;
  }
  if (grader.outputType) {
    return `tool_trace(${grader.tool}, output_type=${grader.outputType})`;
  }
  if (grader.outputSchema) {
    return `tool_trace(${grader.tool}, output_schema=${JSON.stringify(grader.outputSchema)})`;
  }
  return grader.inputContains
    ? `tool_trace(${grader.tool}, input_contains=${grader.inputContains})`
    : `tool_trace(${grader.tool})`;
}

/** Formats a human-readable Markdown report for one Skill Pack eval run. */
function formatSkillPackEvalReport(result: SkillPackEvalRunResult): string {
  return [
    "# Skill Pack Eval Report",
    "",
    `Skill Pack: ${result.skillPack.name}`,
    `Manifest: ${result.manifestPath}`,
    `Result: ${result.passedCount} passed, ${result.failedCount} failed`,
    "",
    "## Cases",
    "",
    ...result.cases.flatMap(formatSkillPackEvalCaseResult)
  ].join("\n");
}

/** Formats one eval case result as a compact Markdown block. */
function formatSkillPackEvalCaseResult(result: SkillPackEvalCaseResult): string[] {
  const status = result.status === "passed" ? "PASS" : "FAIL";
  const lines = [
    `- ${status} ${result.id}`,
    `  - prompt: ${result.prompt}`,
    `  - expected: ${result.expectedOutput}`,
    `  - grader: ${result.grader}`
  ];
  if (result.judge) {
    lines.push(...formatSkillPackEvalJudgeResult(result.judge));
  }
  if (result.reason) {
    lines.push(`  - reason: ${result.reason}`);
  }
  if (result.taskRunId) {
    lines.push(`  - task run: ${result.taskRunId}`);
  }
  return lines;
}

/** Formats model judge details so humans can audit repeated or malformed judge responses. */
function formatSkillPackEvalJudgeResult(judge: SkillPackEvalJudgeResult): string[] {
  return [
    `  - judge: ${judge.passedCount}/${judge.runs} pass (threshold ${judge.passThreshold})`,
    ...judge.verdicts.map(formatSkillPackEvalJudgeVerdict)
  ];
}

/** Formats one judge call verdict without hiding invalid judge output behind the aggregate result. */
function formatSkillPackEvalJudgeVerdict(verdict: SkillPackEvalJudgeVerdict, index: number): string {
  const reason = verdict.reason ? ` - ${verdict.reason}` : "";
  return `  - judge run ${index + 1}: ${verdict.verdict}${reason}`;
}

/** Normalizes names and paths so CLI input can match common Skill Pack forms. */
function normalizeSkillPackTarget(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\\/g, "/").replace(/\/+$/g, "");
}

/** Creates a path-safe directory segment for eval artifacts. */
function safePathSegment(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "skill-pack";
}

/** Creates a sortable eval run id without requiring a shared sequence counter. */
function createEvalRunId(): string {
  return `eval-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Throws when a parsed JSON object contains fields outside the local manifest schema. */
function assertKnownFields(value: Record<string, unknown>, allowedFields: string[], messagePrefix: string): void {
  const unknownField = firstUnknownField(value, allowedFields);
  if (unknownField) {
    throw new Error(`${messagePrefix} ${unknownField}`);
  }
}

/** Finds the first property not declared by the compact eval manifest contract. */
function firstUnknownField(value: Record<string, unknown>, allowedFields: string[]): string | undefined {
  const allowed = new Set(allowedFields);
  return Object.keys(value).find((field) => !allowed.has(field));
}

/** Checks whether a parsed JSON value can be inspected as an object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks that a JSON object has at least one declared key before it becomes an eval matcher. */
function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}

/** Checks non-empty strings used by the eval manifest schema. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Checks output_type declarations against the supported JSON-style value types. */
function isTraceValueType(value: unknown): value is JsonValueType {
  return isJsonValueType(value);
}
