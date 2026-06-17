import { parseAgentStep, type AgentStep } from "../core/agent-step.ts";
import type { ModelProvider, ModelProviderEvent } from "../model/provider.ts";
import {
  appendRunEvent,
  createTaskRun,
  normalizeProjectMemorySection,
  readLatestCheckpoint,
  readLatestTaskRun,
  readProjectMemory,
  readRunEvents,
  selectRelevantProjectMemory,
  type MemorySuggestion,
  type TaskMode,
  type TaskRunRecord,
  updateTaskRunStatus,
  writeCheckpoint,
  writeTaskEvaluation,
  writeMemorySuggestions,
  writeTaskReport
} from "../state/store.ts";
import {
  applyConfirmedToolAction,
  executeLocalTool,
  isConfirmationRequired,
  type ConfirmationRequired
} from "../tools/local-tools.ts";

export interface RunTaskInput {
  workspace: string;
  goal: string;
  mode: TaskMode;
  successCheck: string;
  provider: ModelProvider;
  logStep?: (message: string) => void;
  confirmAction?: (request: ConfirmationRequired) => Promise<boolean> | boolean;
}

export interface RunTaskResult {
  id: string;
  runDir: string;
  status: "completed";
}

export interface ResumeLatestTaskInput {
  workspace: string;
  provider: ModelProvider;
  logStep?: (message: string) => void;
  confirmAction?: (request: ConfirmationRequired) => Promise<boolean> | boolean;
}

export type ResumeLatestTaskResult =
  | RunTaskResult
  | { status: "not_found" }
  | { status: "already_completed"; id: string; runDir: string };

// Keep the bootstrap loop bounded so a provider that never emits `finish`
// cannot leave the CLI spinning forever.
const maxTurns = 8;

/** Starts a new Task Run, records the Owner request, and enters the agent loop. */
export async function runTask(input: RunTaskInput): Promise<RunTaskResult> {
  const run = await createTaskRun(input.workspace, {
    goal: input.goal,
    mode: input.mode,
    successCheck: input.successCheck
  });
  const events: ModelProviderEvent[] = [];

  // The Owner message is recorded as an event even though it is not sent back
  // as a provider event yet; this keeps the Task Run audit trail complete.
  await appendRunEvent(run.runDir, { type: "owner_message", content: input.goal });

  return continueTaskRun({
    workspace: input.workspace,
    run: {
      id: run.id,
      runDir: run.runDir,
      goal: input.goal,
      mode: input.mode,
      successCheck: input.successCheck,
      status: "active",
      createdAt: "",
      updatedAt: ""
    },
    provider: input.provider,
    events: [],
    startTurn: 1,
    logStep: input.logStep,
    confirmAction: input.confirmAction
  });
}

/** Resumes the latest active Task Run from its checkpoint and durable event log. */
export async function resumeLatestTask(input: ResumeLatestTaskInput): Promise<ResumeLatestTaskResult> {
  const run = await readLatestTaskRun(input.workspace);
  if (!run) {
    return { status: "not_found" };
  }
  if (run.status === "completed") {
    return { status: "already_completed", id: run.id, runDir: run.runDir };
  }

  const checkpoint = await readLatestCheckpoint(run.runDir);
  const allEvents = toProviderEvents(await readRunEvents(run.runDir));
  const eventCount = readNumberField(checkpoint?.state, "eventCount");
  const checkpointTurn = readNumberField(checkpoint?.state, "turn");
  const events = typeof eventCount === "number" ? allEvents.slice(0, eventCount) : allEvents;
  const startTurn = (checkpointTurn ?? countAgentSteps(events)) + 1;

  return continueTaskRun({
    workspace: input.workspace,
    run,
    provider: input.provider,
    events,
    startTurn,
    logStep: input.logStep,
    confirmAction: input.confirmAction
  });
}

interface ContinueTaskRunInput {
  workspace: string;
  run: TaskRunRecord;
  provider: ModelProvider;
  events: ModelProviderEvent[];
  startTurn: number;
  logStep?: (message: string) => void;
  confirmAction?: (request: ConfirmationRequired) => Promise<boolean> | boolean;
}

/** Drives provider turns until the model emits a finish step or the turn limit is reached. */
async function continueTaskRun(input: ContinueTaskRunInput): Promise<RunTaskResult> {
  const projectMemory = selectRelevantProjectMemory({
    memory: await readProjectMemory(input.workspace),
    goal: input.run.goal,
    successCheck: input.run.successCheck
  });

  for (let turn = input.startTurn; turn < input.startTurn + maxTurns; turn++) {
    const step = parseAgentStep(
      await input.provider.nextStep({
        goal: input.run.goal,
        mode: input.run.mode,
        successCheck: input.run.successCheck,
        turn,
        events: input.events,
        // Project Memory is filtered into visible context. It is not hidden
        // reasoning, and the durable memory file remains the source of truth.
        projectMemory
      })
    );
    input.logStep?.(formatStepLog(turn, step));
    input.events.push(step);
    await appendRunEvent(input.run.runDir, step);
    if (step.type === "tool") {
      let output = await executeLocalTool(input.workspace, step.tool, step.input);
      if (isConfirmationRequired(output)) {
        const approved = input.confirmAction ? await input.confirmAction(output) : false;
        if (approved) {
          output = await applyConfirmedToolAction(input.workspace, output);
        } else {
          output = {
            type: "confirmation_denied",
            tool: output.tool,
            reason: input.confirmAction ? "Owner denied confirmation" : "No confirmation handler available",
            action: output.action
          };
        }
      }
      // Tool observations are fed back into the next model turn as first-class
      // events, matching the plan -> act -> observe loop used by most agents.
      const toolResult: ModelProviderEvent = { type: "tool_result", tool: step.tool, output };
      input.events.push(toolResult);
      await appendRunEvent(input.run.runDir, toolResult);
    }
    // Checkpoints intentionally store enough visible state to resume or debug a
    // run without depending on hidden model reasoning.
    await writeCheckpoint(input.run.runDir, {
      goal: input.run.goal,
      mode: input.run.mode,
      turn,
      lastStep: step,
      eventCount: input.events.length
    });

    if (step.type === "finish") {
      const memorySuggestions = collectMemorySuggestions(input.events);
      if (memorySuggestions.length > 0) {
        await writeMemorySuggestions(input.run.runDir, memorySuggestions);
      }
      // Evaluation is deterministic for the bootstrap loop; richer checks will
      // replace this once Success Checks and model-assisted review land.
      await writeTaskReport(input.run.runDir, step.report);
      await writeTaskEvaluation(input.run.runDir, {
        verdict: "pass",
        successCheck: "pass",
        gateSafety: "pass",
        traceQuality: "partial",
        reportQuality: "pass",
        learningSignals: [],
        followUps: []
      });
      await updateTaskRunStatus(input.run.runDir, "completed");
      return { id: input.run.id, runDir: input.run.runDir, status: "completed" };
    }
  }

  throw new Error(`Model Provider ${input.provider.name} did not finish within ${maxTurns} turns`);
}

/** Converts durable run events back into the subset that providers can consume. */
function toProviderEvents(events: unknown[]): ModelProviderEvent[] {
  const providerEvents: ModelProviderEvent[] = [];
  for (const event of events) {
    if (isToolResult(event)) {
      providerEvents.push(event);
      continue;
    }
    try {
      providerEvents.push(parseAgentStep(event));
    } catch {
      // Owner messages and future event types stay in the durable event log, but
      // they are not sent as provider events until the model contract includes them.
    }
  }
  return providerEvents;
}

/** Checks whether a durable event is a tool observation that can be replayed to the provider. */
function isToolResult(value: unknown): value is Extract<ModelProviderEvent, { type: "tool_result" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "tool_result" &&
    "tool" in value &&
    typeof value.tool === "string" &&
    "output" in value
  );
}

/** Reads a numeric checkpoint field without trusting the checkpoint shape. */
function readNumberField(value: unknown, field: string): number | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !(field in value)) {
    return null;
  }
  const numberValue = value[field as keyof typeof value];
  return typeof numberValue === "number" ? numberValue : null;
}

/** Counts model-authored Agent Steps while excluding tool observation events. */
function countAgentSteps(events: ModelProviderEvent[]): number {
  return events.filter((event) => event.type !== "tool_result").length;
}

/** Extracts model reflection steps into reviewable Project Memory suggestions. */
function collectMemorySuggestions(events: ModelProviderEvent[]): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];
  for (const event of events) {
    if (event.type !== "reflect") {
      continue;
    }

    const section = normalizeProjectMemorySection(event.section ?? "open-threads") ?? "open-threads";
    // Reflection notes are candidates, not durable memory. The Owner still gets
    // an explicit review/apply step before they enter Project Memory.
    suggestions.push({
      section,
      note: event.note,
      reason: "Model reflection during the Task Run",
      source: "model_reflect"
    });
  }
  return suggestions;
}

/** Formats one provider step as a compact progress line for the CLI. */
function formatStepLog(turn: number, step: AgentStep): string {
  return `[agent] turn ${turn} ${step.type} - ${compactLogDetail(formatStepDetail(step))}`;
}

/** Converts each Agent Step variant into the human-readable part of a progress line. */
function formatStepDetail(step: AgentStep): string {
  if (step.type === "plan") {
    return `${step.summary} | steps: ${step.steps.join("; ")}`;
  }
  if (step.type === "message") {
    return step.content;
  }
  if (step.type === "tool") {
    return `${step.tool} ${safeJson(step.input)}`;
  }
  if (step.type === "confirm") {
    return step.prompt;
  }
  if (step.type === "reflect") {
    return step.note;
  }
  return step.report;
}

/** Safely serializes model-provided tool input for console progress logs. */
function safeJson(value: unknown): string {
  // Tool inputs come from model output. JSON.stringify can throw for unusual
  // cyclic values in tests, so keep console logging best-effort and non-fatal.
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable input]";
  }
}

/** Collapses multiline model content into a single stable console progress line. */
function compactLogDetail(detail: string): string {
  // Console progress is one line per model step; durable run files keep the
  // complete multiline content for later inspection.
  return detail.replace(/\s+/g, " ").trim();
}
