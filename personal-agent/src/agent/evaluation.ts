import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { parseAgentStep } from "../core/agent-step.ts";
import type { StructuredSuccessCheck } from "../core/success-check.ts";
import type { HumanVerdictOverride, TaskVerdict } from "../core/task-verdict.ts";
import type { ModelProvider, ModelProviderEvent } from "../model/provider.ts";
import type { MemorySuggestion } from "../state/store.ts";

export interface CreateTaskEvaluationInput {
  workspace: string;
  successCheck: string;
  successChecks?: StructuredSuccessCheck[];
  report: string;
  events: ModelProviderEvent[];
  memorySuggestions: MemorySuggestion[];
}

export interface EvaluationEvidence {
  source: "declaration" | "report" | "event" | "workspace";
  reference: string;
  detail: string;
}

export interface EvaluationCheckResult {
  id: string;
  verdict: "pass" | "partial" | "fail" | "unavailable";
  evidence: EvaluationEvidence[];
}

export interface EvaluationDimension {
  verdict: EvaluationCheckResult["verdict"];
  evidence: EvaluationEvidence[];
  checks: EvaluationCheckResult[];
}

export interface TaskEvaluation {
  schemaVersion: 2;
  // `verdict` remains the immutable deterministic result. Human review changes
  // effectiveVerdict and appends audit records instead of replacing evidence.
  verdict: TaskVerdict;
  effectiveVerdict: TaskVerdict;
  humanOverrides: HumanVerdictOverride[];
  executionIntegrity: EvaluationDimension;
  taskCorrectness: EvaluationDimension;
  // Compatibility summaries keep existing history and integrations readable
  // while V2 consumers migrate to the evidence-bearing dimensions above.
  successCheck: "pass" | "fail" | "unavailable";
  gateSafety: "pass" | "fail";
  traceQuality: "pass" | "partial" | "fail";
  reportQuality: "pass" | "partial" | "fail";
  learningSignals: string[];
  followUps: string[];
  modelReview?: ModelReview;
}

export interface ModelReview {
  verdict: "pass" | "partial" | "fail" | "blocked" | "unavailable" | "invalid";
  reason: string;
}

export interface CreateModelReviewInput {
  provider: ModelProvider;
  goal: string;
  mode: "advisory" | "execution";
  successCheck: string;
  report: string;
  events: ModelProviderEvent[];
  deterministicEvaluation: TaskEvaluation;
}

/** Builds a deterministic post-run evaluation from visible events and workspace artifacts. */
export async function createTaskEvaluation(input: CreateTaskEvaluationInput): Promise<TaskEvaluation> {
  const gateSafety = evaluateGateSafety(input.events);
  const traceQuality = evaluateTraceQuality(input.events);
  const reportQuality = evaluateReportQuality(input.report);
  const executionIntegrity = createExecutionIntegrityDimension({
    events: input.events,
    report: input.report,
    gateSafety,
    traceQuality,
    reportQuality
  });
  const taskCorrectness = await evaluateTaskCorrectness(input);
  const successCheck = toLegacySuccessCheck(taskCorrectness.verdict);
  const learningSignals = collectLearningSignals(input.memorySuggestions);
  const followUps = collectFollowUps(input.memorySuggestions);

  const verdict = combineTaskVerdict(executionIntegrity.verdict, taskCorrectness.verdict);
  return {
    schemaVersion: 2,
    verdict,
    effectiveVerdict: verdict,
    humanOverrides: [],
    executionIntegrity,
    taskCorrectness,
    successCheck,
    gateSafety,
    traceQuality,
    reportQuality,
    learningSignals,
    followUps
  };
}

/** Requests an optional model-assisted self-review without changing the deterministic verdict. */
export async function createModelAssistedReview(input: CreateModelReviewInput): Promise<ModelReview> {
  if (input.provider.name.startsWith("bootstrap")) {
    return {
      verdict: "unavailable",
      reason: "Model-assisted review requires a real Model Provider."
    };
  }

  try {
    const step = parseAgentStep(
      await input.provider.nextStep({
        goal: `Review completed Task Run: ${input.goal}`,
        mode: input.mode,
        interaction: "task",
        successCheck: "Return model review JSON with verdict and reason.",
        turn: countModelAuthoredEvents(input.events) + 1,
        events: input.events,
        projectMemory: JSON.stringify({
          taskReport: input.report,
          deterministicEvaluation: input.deterministicEvaluation
        })
      })
    );
    if (step.type !== "finish") {
      return { verdict: "invalid", reason: `Model review returned ${step.type} instead of finish.` };
    }
    return parseModelReviewReport(step.report);
  } catch (error) {
    return { verdict: "invalid", reason: `Model-assisted review failed: ${readErrorMessage(error)}` };
  }
}

/** Counts model-authored events so the review call receives a stable synthetic turn number. */
function countModelAuthoredEvents(events: ModelProviderEvent[]): number {
  return events.filter(
    (event) => event.type !== "owner_message" && event.type !== "tool_result" && event.type !== "recovery"
  ).length;
}

/** Parses the model review JSON report into the stored modelReview shape. */
function parseModelReviewReport(report: string): ModelReview {
  try {
    const parsed = JSON.parse(report) as Record<string, unknown>;
    const verdict = parsed.verdict;
    const reason = parsed.reason;
    if (!isModelReviewVerdict(verdict) || typeof reason !== "string" || reason.trim().length === 0) {
      return { verdict: "invalid", reason: "Model review JSON must include verdict and non-empty reason." };
    }
    return { verdict, reason };
  } catch (error) {
    return { verdict: "invalid", reason: `Model review report was not valid JSON: ${readErrorMessage(error)}` };
  }
}

/** Checks whether an unknown model verdict is accepted for model-assisted review. */
function isModelReviewVerdict(value: unknown): value is ModelReview["verdict"] {
  return value === "pass" || value === "partial" || value === "fail" || value === "blocked";
}

/** Extracts a readable message from unknown errors returned by providers or JSON parsing. */
function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Groups trace, confirmation, and report checks separately from outcome correctness. */
function createExecutionIntegrityDimension(input: {
  events: ModelProviderEvent[];
  report: string;
  gateSafety: TaskEvaluation["gateSafety"];
  traceQuality: TaskEvaluation["traceQuality"];
  reportQuality: TaskEvaluation["reportQuality"];
}): EvaluationDimension {
  const unresolvedConfirmations = input.events.filter(eventHasUnresolvedConfirmation).length;
  const eventTypes = input.events.map((event) => event.type);
  const checks: EvaluationCheckResult[] = [
    {
      id: "confirmation_resolution",
      verdict: input.gateSafety,
      evidence: [
        {
          source: "event",
          reference: "events.jsonl",
          detail:
            unresolvedConfirmations === 0
              ? "No unresolved confirmation request remained in the durable trace."
              : `${unresolvedConfirmations} unresolved confirmation request(s) remained in the durable trace.`
        }
      ]
    },
    {
      id: "trace_completeness",
      verdict: input.traceQuality,
      evidence: [
        {
          source: "event",
          reference: "events.jsonl",
          detail: `Observed event types: ${eventTypes.length > 0 ? eventTypes.join(", ") : "none"}.`
        }
      ]
    },
    {
      id: "report_presence",
      verdict: input.reportQuality,
      evidence: [
        {
          source: "report",
          reference: "report.md",
          detail: `Final report contains ${input.report.trim().length} non-whitespace character(s).`
        }
      ]
    }
  ];

  return {
    verdict: combineExecutionIntegrityVerdict(checks),
    evidence: checks.flatMap((check) => check.evidence),
    checks
  };
}

/** Executes declared outcome checks and records the artifact behind each verdict. */
async function evaluateTaskCorrectness(input: CreateTaskEvaluationInput): Promise<EvaluationDimension> {
  const checks = input.successChecks ?? [];
  if (checks.length === 0) {
    return {
      verdict: "unavailable",
      evidence: [
        {
          source: "declaration",
          reference: "run.json#successChecks",
          detail: `No structured Success Check was declared. Human-readable check: ${input.successCheck || "none"}.`
        }
      ],
      checks: []
    };
  }

  const results: EvaluationCheckResult[] = [];
  for (const check of checks) {
    results.push(await evaluateStructuredSuccessCheck(input, check));
  }

  return {
    verdict: results.some((result) => result.verdict === "fail") ? "fail" : "pass",
    evidence: results.flatMap((result) => result.evidence),
    checks: results
  };
}

/** Dispatches one structured Success Check to its deterministic evaluator. */
async function evaluateStructuredSuccessCheck(
  input: CreateTaskEvaluationInput,
  check: StructuredSuccessCheck
): Promise<EvaluationCheckResult> {
  if (check.type === "report_contains") {
    const matched = normalizeComparableText(input.report).includes(normalizeComparableText(check.value));
    return {
      id: check.id,
      verdict: matched ? "pass" : "fail",
      evidence: [
        {
          source: "report",
          reference: "report.md",
          detail: `Expected text ${JSON.stringify(check.value)} was ${matched ? "found" : "not found"} in the final report.`
        }
      ]
    };
  }

  if (check.type === "tool_succeeded") {
    return evaluateToolSucceeded(check, input.events);
  }

  return evaluateWorkspaceFileCheck(input.workspace, check);
}

/** Evaluates file existence and content without allowing paths outside the workspace. */
async function evaluateWorkspaceFileCheck(
  workspace: string,
  check: Extract<StructuredSuccessCheck, { type: "file_exists" | "file_contains" }>
): Promise<EvaluationCheckResult> {
  try {
    const target = await resolveWorkspaceArtifact(workspace, check.path);
    const metadata = await stat(target);
    if (!metadata.isFile()) {
      return failedWorkspaceCheck(check.id, check.path, "The path exists but is not a file.");
    }

    if (check.type === "file_exists") {
      return {
        id: check.id,
        verdict: "pass",
        evidence: [{ source: "workspace", reference: check.path, detail: "The expected file exists." }]
      };
    }

    const content = await readFile(target, "utf8");
    const matched = normalizeComparableText(content).includes(normalizeComparableText(check.value));
    return {
      id: check.id,
      verdict: matched ? "pass" : "fail",
      evidence: [
        {
          source: "workspace",
          reference: check.path,
          detail: `Expected text ${JSON.stringify(check.value)} was ${matched ? "found" : "not found"} in the file.`
        }
      ]
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return failedWorkspaceCheck(check.id, check.path, "Expected file does not exist.");
    }
    return failedWorkspaceCheck(check.id, check.path, readErrorMessage(error));
  }
}

/** Checks for at least one successful durable result from the requested Local Tool. */
function evaluateToolSucceeded(
  check: Extract<StructuredSuccessCheck, { type: "tool_succeeded" }>,
  events: ModelProviderEvent[]
): EvaluationCheckResult {
  const matches = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === "tool_result" && event.tool === check.tool);
  const successful = matches.find(({ event }) => event.type === "tool_result" && toolOutputSucceeded(event.output));

  return {
    id: check.id,
    verdict: successful ? "pass" : "fail",
    evidence: [
      {
        source: "event",
        reference: successful ? `events.jsonl#${successful.index + 1}` : "events.jsonl",
        detail: successful
          ? `Tool ${JSON.stringify(check.tool)} produced a successful result.`
          : `Tool ${JSON.stringify(check.tool)} produced no successful result across ${matches.length} matching event(s).`
      }
    ]
  };
}

/** Resolves an existing artifact and rejects traversal or symlink escapes. */
async function resolveWorkspaceArtifact(workspace: string, path: string): Promise<string> {
  const root = await realpath(workspace);
  const target = resolve(root, path);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Path escapes workspace: ${path}`);
  }

  const actualTarget = await realpath(target);
  if (actualTarget !== root && !actualTarget.startsWith(`${root}${sep}`)) {
    throw new Error(`Path resolves outside workspace: ${path}`);
  }
  return actualTarget;
}

/** Creates a failed file check with a stable workspace evidence reference. */
function failedWorkspaceCheck(id: string, path: string, detail: string): EvaluationCheckResult {
  return { id, verdict: "fail", evidence: [{ source: "workspace", reference: path, detail }] };
}

/** Treats rejected, denied, unresolved, and non-zero command outputs as unsuccessful. */
function toolOutputSucceeded(output: unknown): boolean {
  // Read/list/search tools return strings or arrays. Object results must use a
  // known success type so future error shapes fail closed instead of passing.
  if (typeof output === "string" || Array.isArray(output)) {
    return true;
  }
  if (!isRecord(output) || typeof output.type !== "string") {
    return false;
  }
  if (output.type === "rejected" || output.type === "confirmation_denied" || output.type === "confirmation_required") {
    return false;
  }
  if (output.type === "command_result") {
    return typeof output.exitCode === "number" && output.exitCode === 0;
  }
  return output.type === "file_written";
}

/** Normalizes deterministic text checks across Unicode width and letter case. */
function normalizeComparableText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/** Fails only when a confirmation-required action somehow remains unresolved in the durable trace. */
function evaluateGateSafety(events: ModelProviderEvent[]): TaskEvaluation["gateSafety"] {
  return events.some(eventHasUnresolvedConfirmation) ? "fail" : "pass";
}

/** Rates whether the trace shows both planning and completion, or only a minimal finish. */
function evaluateTraceQuality(events: ModelProviderEvent[]): TaskEvaluation["traceQuality"] {
  const hasFinish = events.some((event) => event.type === "finish");
  if (!hasFinish) {
    return "fail";
  }
  const hasTaskPlan = events.some((event) => event.type === "plan");
  const hasChatExchange =
    events.some((event) => event.type === "owner_message") && events.some((event) => event.type === "message");
  // Task runs show intent through a plan. Chat runs show progress through
  // explicit Owner turns plus model replies, so either pattern is reviewable.
  return hasTaskPlan || hasChatExchange ? "pass" : "partial";
}

/** Checks whether the final report contains usable text for later review. */
function evaluateReportQuality(report: string): TaskEvaluation["reportQuality"] {
  return report.trim().length > 0 ? "pass" : "fail";
}

/** Converts generated review artifacts into durable learning signals. */
function collectLearningSignals(memorySuggestions: MemorySuggestion[]): string[] {
  return memorySuggestions.length > 0 ? ["Project Memory suggestion"] : [];
}

/** Suggests review actions that should happen after a completed run. */
function collectFollowUps(memorySuggestions: MemorySuggestion[]): string[] {
  return memorySuggestions.length > 0 ? ["Review Memory Suggestions"] : [];
}

/** Combines execution and correctness without letting a polished report hide a failed outcome. */
function combineTaskVerdict(
  executionIntegrity: EvaluationDimension["verdict"],
  taskCorrectness: EvaluationDimension["verdict"]
): TaskEvaluation["verdict"] {
  if (executionIntegrity === "fail" || taskCorrectness === "fail") {
    return "fail";
  }
  if (executionIntegrity === "partial" || taskCorrectness === "unavailable") {
    return "partial";
  }
  return "pass";
}

/** Reduces execution checks while preserving partial trace-quality results. */
function combineExecutionIntegrityVerdict(checks: EvaluationCheckResult[]): EvaluationDimension["verdict"] {
  if (checks.some((check) => check.verdict === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.verdict === "partial" || check.verdict === "unavailable")) {
    return "partial";
  }
  return "pass";
}

/** Maps V2 correctness onto the legacy scalar field retained for existing readers. */
function toLegacySuccessCheck(verdict: EvaluationDimension["verdict"]): TaskEvaluation["successCheck"] {
  if (verdict === "pass" || verdict === "fail") {
    return verdict;
  }
  return "unavailable";
}

/** Detects a confirmation request that was recorded as a tool result instead of being approved or denied. */
function eventHasUnresolvedConfirmation(event: ModelProviderEvent): boolean {
  return (
    event.type === "tool_result" &&
    typeof event.output === "object" &&
    event.output !== null &&
    !Array.isArray(event.output) &&
    "type" in event.output &&
    event.output.type === "confirmation_required"
  );
}

/** Checks whether an unknown value is a record that can be inspected safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Detects missing filesystem artifacts without persisting machine-specific absolute paths. */
function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
