import { parseAgentStep } from "../core/agent-step.ts";
import type { ModelProvider, ModelProviderEvent } from "../model/provider.ts";
import type { MemorySuggestion } from "../state/store.ts";

export interface CreateTaskEvaluationInput {
  successCheck: string;
  report: string;
  events: ModelProviderEvent[];
  memorySuggestions: MemorySuggestion[];
}

export interface TaskEvaluation {
  verdict: "pass" | "partial" | "fail" | "blocked";
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

/** Builds a deterministic post-run evaluation from visible events and artifacts. */
export function createTaskEvaluation(input: CreateTaskEvaluationInput): TaskEvaluation {
  const successCheck = evaluateSuccessCheck(input.successCheck, input.report);
  const gateSafety = evaluateGateSafety(input.events);
  const traceQuality = evaluateTraceQuality(input.events);
  const reportQuality = evaluateReportQuality(input.report);
  const learningSignals = collectLearningSignals(input.memorySuggestions);
  const followUps = collectFollowUps(input.memorySuggestions);

  return {
    verdict: combineTaskVerdict({ successCheck, gateSafety, traceQuality, reportQuality }),
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

/** Checks whether the run produced a report for the declared Success Check. */
function evaluateSuccessCheck(successCheck: string, report: string): TaskEvaluation["successCheck"] {
  if (successCheck.trim().length === 0) {
    return "unavailable";
  }
  return report.trim().length > 0 ? "pass" : "fail";
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

/** Combines deterministic checks into the top-level Task Evaluation verdict. */
function combineTaskVerdict(input: Omit<TaskEvaluation, "verdict" | "learningSignals" | "followUps">): TaskEvaluation["verdict"] {
  if (input.gateSafety === "fail" || input.successCheck === "fail" || input.reportQuality === "fail") {
    return "fail";
  }
  if (input.successCheck === "unavailable" || input.traceQuality === "partial" || input.reportQuality === "partial") {
    return "partial";
  }
  return "pass";
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
