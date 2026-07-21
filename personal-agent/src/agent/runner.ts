import { parseAgentStep, type AgentStep } from "../core/agent-step.ts";
import { createModelAssistedReview, createTaskEvaluation } from "./evaluation.ts";
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
  type ConfirmationRequired,
  type ConfirmationResponse
} from "../tools/local-tools.ts";
import {
  formatSkillPackContext,
  selectRelevantSkillPackMatches,
  type SelectedSkillPackSummary,
  type SkillPackSummary
} from "../skills/skill-packs.ts";

export interface RunTaskInput {
  workspace: string;
  goal: string;
  mode: TaskMode;
  successCheck: string;
  provider: ModelProvider;
  logStep?: (message: string) => void;
  learningLens?: boolean;
  modelReview?: boolean;
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
}

export interface RunTaskResult {
  id: string;
  runDir: string;
  status: "completed";
}

export interface RunChatTaskInput {
  workspace: string;
  provider: ModelProvider;
  messages: Iterable<string> | AsyncIterable<string>;
  logStep?: (message: string) => void;
  learningLens?: boolean;
  modelReview?: boolean;
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
  onAgentMessage?: (message: string) => void;
}

export type RunChatTaskResult = RunTaskResult;

export interface ResumeLatestTaskInput {
  workspace: string;
  provider: ModelProvider;
  logStep?: (message: string) => void;
  learningLens?: boolean;
  modelReview?: boolean;
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
  onAgentMessage?: (message: string) => void;
}

export type ResumeLatestTaskResult =
  | RunTaskResult
  | { status: "not_found" }
  | { status: "already_completed"; id: string; runDir: string };

// Keep the bootstrap loop bounded so a provider that never emits `finish`
// cannot leave the CLI spinning forever.
const maxTurns = 8;

// Keep schema repair bounded so malformed model output cannot create an
// invisible infinite retry loop.
const maxRecoveryAttempts = 2;

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
    interaction: "task",
    events: [],
    startTurn: 1,
    logStep: input.logStep,
    learningLens: input.learningLens,
    modelReview: input.modelReview,
    confirmAction: input.confirmAction
  });
}

/** Starts one persistent chat Task Run and appends each Owner message into the same event log. */
export async function runChatTask(input: RunChatTaskInput): Promise<RunChatTaskResult> {
  const iterator = toAsyncStringIterator(input.messages);
  try {
    const firstMessage = await readNextChatMessage(iterator);
    if (firstMessage === null) {
      throw new Error("Chat Task requires at least one Owner message");
    }

    const successCheck = "Chat produces a local Task Report when the conversation is finished";
    const goal = createChatGoal(firstMessage);
    const run = await createTaskRun(input.workspace, {
      goal,
      mode: "advisory",
      successCheck
    });
    const runRecord: TaskRunRecord = {
      id: run.id,
      runDir: run.runDir,
      goal,
      mode: "advisory",
      successCheck,
      status: "active",
      createdAt: "",
      updatedAt: ""
    };
    const continueInput: ContinueTaskRunInput = {
      workspace: input.workspace,
      run: runRecord,
      provider: input.provider,
      interaction: "chat",
      events: [],
      startTurn: 1,
      logStep: input.logStep,
      learningLens: input.learningLens,
      modelReview: input.modelReview,
      confirmAction: input.confirmAction,
      onAgentMessage: input.onAgentMessage
    };

    const projectMemory = selectRelevantProjectMemory({
      memory: await readProjectMemory(input.workspace),
      goal: runRecord.goal,
      successCheck: runRecord.successCheck
    });
    const skillPackSummaries = await resolveSkillPackSelection({
      runDir: run.runDir,
      startTurn: 1,
      confirmAction: input.confirmAction,
      skillPacks: await selectRelevantSkillPackMatches({
        workspace: input.workspace,
        goal: runRecord.goal,
        successCheck: runRecord.successCheck
      })
    });
    const skillPacks = formatSkillPackContext(skillPackSummaries);
    if (skillPackSummaries.length > 0) {
      // Skill Pack selection is durable audit data; the provider gets the
      // formatted guidance field rather than this bookkeeping event.
      await appendRunEvent(run.runDir, { type: "skill_packs", skillPacks: skillPackSummaries });
    }

    let turn = 1;
    let ownerMessageCount = 0;
    let ownerMessage: string | null = firstMessage;
    while (ownerMessage !== null) {
      ownerMessageCount += 1;
      await appendOwnerMessage(continueInput, ownerMessage);
      turn = await respondToOwnerMessage(continueInput, turn, projectMemory, skillPacks);
      ownerMessage = await readNextChatMessage(iterator);
    }

    // The CLI owns conversation lifetime. Once input ends, append a
    // runner-authored finish event so reports and evaluation stay available
    // without allowing a model reply to terminate the chat unexpectedly.
    const report = createChatReport(runRecord, input.provider, ownerMessageCount);
    await recordAgentStepAndObservations(continueInput, turn, { type: "finish", report });
    return completeTaskRun(continueInput, report);
  } finally {
    await closeChatIterator(iterator);
  }
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
    interaction: "task",
    events,
    startTurn,
    logStep: input.logStep,
    learningLens: input.learningLens,
    modelReview: input.modelReview,
    confirmAction: input.confirmAction
  });
}

interface ContinueTaskRunInput {
  workspace: string;
  run: TaskRunRecord;
  provider: ModelProvider;
  interaction: "task" | "chat";
  events: ModelProviderEvent[];
  startTurn: number;
  logStep?: (message: string) => void;
  learningLens?: boolean;
  modelReview?: boolean;
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
  onAgentMessage?: (message: string) => void;
}

interface ResolveSkillPackSelectionInput {
  runDir: string;
  startTurn: number;
  skillPacks: SelectedSkillPackSummary[];
  confirmAction?: (request: ConfirmationRequired) => Promise<ConfirmationResponse> | ConfirmationResponse;
}

/** Drives provider turns until the model emits a finish step or the turn limit is reached. */
async function continueTaskRun(input: ContinueTaskRunInput): Promise<RunTaskResult> {
  const projectMemory = selectRelevantProjectMemory({
    memory: await readProjectMemory(input.workspace),
    goal: input.run.goal,
    successCheck: input.run.successCheck
  });
  const skillPackSummaries = await resolveSkillPackSelection({
    runDir: input.run.runDir,
    startTurn: input.startTurn,
    confirmAction: input.confirmAction,
    skillPacks: await selectRelevantSkillPackMatches({
      workspace: input.workspace,
      goal: input.run.goal,
      successCheck: input.run.successCheck
    })
  });
  const skillPacks = formatSkillPackContext(skillPackSummaries);
  if (skillPackSummaries.length > 0 && input.startTurn === 1) {
    // Record selected Skill Packs as durable audit data without feeding this
    // bookkeeping event back into the provider event stream.
    await appendRunEvent(input.run.runDir, { type: "skill_packs", skillPacks: skillPackSummaries });
  }

  for (let turn = input.startTurn; turn < input.startTurn + maxTurns; turn++) {
    const step = await requestValidAgentStep(input, turn, projectMemory, skillPacks);
    await recordAgentStepAndObservations(input, turn, step);

    if (step.type === "finish") {
      return completeTaskRun(input, step.report);
    }
  }

  throw new Error(`Model Provider ${input.provider.name} did not finish within ${maxTurns} turns`);
}

/** Lets a chat Owner message drive internal model steps until the agent replies or finishes. */
async function respondToOwnerMessage(
  input: ContinueTaskRunInput,
  startTurn: number,
  projectMemory: string,
  skillPacks: string
): Promise<number> {
  for (let offset = 0; offset < maxTurns; offset++) {
    const turn = startTurn + offset;
    const step = await requestValidAgentStep(input, turn, projectMemory, skillPacks);
    await recordAgentStepAndObservations(input, turn, step);

    if (step.type === "message") {
      return turn + 1;
    }
  }

  throw new Error(`Model Provider ${input.provider.name} did not answer the chat message within ${maxTurns} turns`);
}

/** Records one validated Agent Step, executes any Local Tool request, and writes a checkpoint. */
async function recordAgentStepAndObservations(
  input: ContinueTaskRunInput,
  turn: number,
  step: AgentStep
): Promise<void> {
  input.logStep?.(formatStepLog(turn, step));
  emitLearningLensForStep(input, step);
  input.events.push(step);
  await appendRunEvent(input.run.runDir, step);
  if (step.type === "message") {
    input.onAgentMessage?.(step.content);
  }
  if (step.type === "tool") {
    await recordToolObservation(input, step);
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
  emitLearningLens(input, "checkpoint", "Checkpoints save visible state so interrupted runs can resume.");
}

/** Executes one Local Tool step and appends its observation to the provider-visible event stream. */
async function recordToolObservation(input: ContinueTaskRunInput, step: Extract<AgentStep, { type: "tool" }>): Promise<void> {
  let output = await executeLocalTool(input.workspace, step.tool, step.input);
  if (isConfirmationRequired(output)) {
    emitLearningLens(
      input,
      "confirmation",
      "Confirmation Gates pause high-impact actions before they change the workspace."
    );
    const decision = input.confirmAction ? await input.confirmAction(output) : false;
    if (confirmationWasApproved(decision)) {
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
  emitLearningLens(
    input,
    "observation",
    "Tool observations turn workspace facts into context for the next model turn."
  );
}

/** Writes final artifacts and marks a Task Run completed after a finish step. */
async function completeTaskRun(input: ContinueTaskRunInput, report: string): Promise<RunTaskResult> {
  const memorySuggestions = collectMemorySuggestions(input.events);
  if (memorySuggestions.length > 0) {
    await writeMemorySuggestions(input.run.runDir, memorySuggestions);
  }
  await writeTaskReport(input.run.runDir, report);
  const evaluation = createTaskEvaluation({
    successCheck: input.run.successCheck,
    report,
    events: input.events,
    memorySuggestions
  });
  if (input.modelReview) {
    evaluation.modelReview = await createModelAssistedReview({
      provider: input.provider,
      goal: input.run.goal,
      mode: input.run.mode,
      successCheck: input.run.successCheck,
      report,
      events: input.events,
      deterministicEvaluation: evaluation
    });
  }
  await writeTaskEvaluation(input.run.runDir, evaluation);
  emitLearningLens(input, "evaluation", "Task Evaluation scores the report and trace from visible artifacts.");
  await updateTaskRunStatus(input.run.runDir, "completed");
  return { id: input.run.id, runDir: input.run.runDir, status: "completed" };
}

/** Appends a user-visible Owner message to both in-memory context and the durable event log. */
async function appendOwnerMessage(input: ContinueTaskRunInput, content: string): Promise<void> {
  const ownerMessage: ModelProviderEvent = { type: "owner_message", content };
  input.events.push(ownerMessage);
  await appendRunEvent(input.run.runDir, ownerMessage);
}

/** Requests one provider-neutral Agent Step, retrying the same turn after parse failures. */
async function requestValidAgentStep(
  input: ContinueTaskRunInput,
  turn: number,
  projectMemory: string,
  skillPacks: string
): Promise<AgentStep> {
  for (let recoveryAttempt = 0; recoveryAttempt <= maxRecoveryAttempts; recoveryAttempt++) {
    const rawStep = await input.provider.nextStep({
      goal: input.run.goal,
      mode: input.run.mode,
      interaction: input.interaction,
      successCheck: input.run.successCheck,
      turn,
      events: input.events,
      // Project Memory is filtered into visible context. It is not hidden
      // reasoning, and the durable memory file remains the source of truth.
      projectMemory,
      // Skill Packs are guidance context only in this MVP. Script execution
      // remains behind Local Tools and their normal confirmation gates.
      skillPacks: skillPacks.length > 0 ? skillPacks : undefined
    });

    try {
      return validateAgentStepForInteraction(parseAgentStep(rawStep), input.interaction);
    } catch (error) {
      const reason = readErrorMessage(error);
      if (recoveryAttempt >= maxRecoveryAttempts) {
        throw new Error(
          `Model Provider ${input.provider.name} failed to produce a valid Agent Step after ` +
            `${maxRecoveryAttempts} recovery attempts: ${reason}`
        );
      }

      const recovery: ModelProviderEvent = {
        type: "recovery",
        reason,
        attempt: recoveryAttempt + 1
      };
      input.events.push(recovery);
      await appendRunEvent(input.run.runDir, recovery);
      input.logStep?.(`[agent] turn ${turn} recovery - ${compactLogDetail(reason)}`);
      emitLearningLens(
        input,
        "recovery",
        "Recovery turns invalid model output into visible feedback before retrying the same turn."
      );
    }
  }

  throw new Error(`Model Provider ${input.provider.name} recovery loop ended unexpectedly`);
}

/** Enforces lifecycle rules that differ between task completion and chat replies. */
function validateAgentStepForInteraction(step: AgentStep, interaction: "task" | "chat"): AgentStep {
  if (interaction === "chat" && step.type === "finish") {
    throw new Error("Chat interaction cannot return finish; answer the latest Owner message with message");
  }
  return step;
}

/** Resolves selected Skill Packs, asking the Owner before injecting ambiguous automatic matches. */
async function resolveSkillPackSelection(input: ResolveSkillPackSelectionInput): Promise<SkillPackSummary[]> {
  const summaries = input.skillPacks.map(stripSkillPackSelectionMetadata);
  if (!shouldConfirmSkillPackSelection(input.skillPacks, input.startTurn)) {
    return summaries;
  }

  const confirmation = createSkillPackConfirmation(input.skillPacks);
  const decision = input.confirmAction ? await input.confirmAction(confirmation) : false;
  const selectedSkillPacks = selectConfirmedSkillPacks(input.skillPacks, decision);
  await appendRunEvent(input.runDir, {
    type: "skill_packs_confirmation",
    approved: selectedSkillPacks.length > 0,
    reason: confirmation.reason,
    skillPacks: summaries,
    selectedSkillPacks
  });

  return selectedSkillPacks;
}

/** Interprets either legacy boolean approval or a richer confirmation decision. */
function confirmationWasApproved(decision: ConfirmationResponse): boolean {
  return typeof decision === "boolean" ? decision : decision.approved;
}

/** Applies a confirmation response to the candidate Skill Pack list. */
function selectConfirmedSkillPacks(
  skillPacks: SelectedSkillPackSummary[],
  decision: ConfirmationResponse
): SkillPackSummary[] {
  if (!confirmationWasApproved(decision)) {
    return [];
  }
  if (typeof decision !== "boolean" && Array.isArray(decision.selected)) {
    const selected = new Set(decision.selected);
    return skillPacks.filter((skillPack) => selected.has(skillPack.path)).map(stripSkillPackSelectionMetadata);
  }
  return skillPacks.map(stripSkillPackSelectionMetadata);
}

/** Requires confirmation when multiple selected Skill Packs were not all explicitly named. */
function shouldConfirmSkillPackSelection(skillPacks: SelectedSkillPackSummary[], startTurn: number): boolean {
  return startTurn === 1 && skillPacks.length > 1 && !skillPacks.every((skillPack) => skillPack.explicitlyNamed);
}

/** Creates a confirmation request for ambiguous Skill Pack guidance injection. */
function createSkillPackConfirmation(skillPacks: SelectedSkillPackSummary[]): ConfirmationRequired {
  return {
    type: "confirmation_required",
    tool: "skill_packs",
    reason: "multiple Skill Packs matched automatically; approve before injecting all guidance",
    action: { skillPacks: skillPacks.map((skillPack) => skillPack.path) },
    preview: {
      skillPacks: skillPacks.map((skillPack) => ({
        name: skillPack.name,
        path: skillPack.path,
        score: skillPack.score,
        explicitlyNamed: skillPack.explicitlyNamed
      }))
    }
  };
}

/** Drops matcher-only fields before storing or formatting selected Skill Packs. */
function stripSkillPackSelectionMetadata(skillPack: SelectedSkillPackSummary): SkillPackSummary {
  return {
    name: skillPack.name,
    description: skillPack.description,
    path: skillPack.path,
    resources: skillPack.resources
  };
}

/** Creates a concise history label for a chat run from the first Owner message. */
function createChatGoal(firstMessage: string): string {
  const preview = compactLogDetail(firstMessage).slice(0, 80);
  return preview.length > 0 ? `Chat conversation: ${preview}` : "Chat conversation";
}

/** Creates the durable report when terminal input closes an interactive chat. */
function createChatReport(run: TaskRunRecord, provider: ModelProvider, ownerMessageCount: number): string {
  const model = provider.model ? ` (${provider.model})` : "";
  return [
    "# Chat Report",
    "",
    `Goal: ${run.goal}`,
    "",
    `Provider: ${provider.name}${model}`,
    "",
    `Owner Messages: ${ownerMessageCount}`,
    "",
    "Outcome: The conversation ended when the Owner exited or input closed.",
    "",
    `Success Check: ${run.successCheck}`,
    "",
    "Verification: Owner messages, model replies, checkpoints, and evaluation were written locally."
  ].join("\n");
}

/** Converts sync and async message sources into one async iterator contract. */
function toAsyncStringIterator(messages: Iterable<string> | AsyncIterable<string>): AsyncIterator<string> {
  if (isAsyncStringIterable(messages)) {
    return messages[Symbol.asyncIterator]();
  }
  const iterator = messages[Symbol.iterator]();
  return {
    /** Wraps a synchronous message iterator so chat can consume both arrays and terminal input. */
    async next() {
      return iterator.next();
    }
  };
}

/** Reads the next non-empty Owner message, returning null when the source is exhausted. */
async function readNextChatMessage(iterator: AsyncIterator<string>): Promise<string | null> {
  while (true) {
    const next = await iterator.next();
    if (next.done) {
      return null;
    }
    const message = next.value.trim();
    if (message.length > 0) {
      return message;
    }
  }
}

/** Gives terminal-backed chat iterators a chance to release readline resources early. */
async function closeChatIterator(iterator: AsyncIterator<string>): Promise<void> {
  if (typeof iterator.return !== "function") {
    return;
  }
  await iterator.return();
}

/** Checks whether a message source already implements the async iterator protocol. */
function isAsyncStringIterable(value: Iterable<string> | AsyncIterable<string>): value is AsyncIterable<string> {
  return Symbol.asyncIterator in Object(value);
}

/** Converts durable run events back into the subset that providers can consume. */
function toProviderEvents(events: unknown[]): ModelProviderEvent[] {
  const providerEvents: ModelProviderEvent[] = [];
  for (const event of events) {
    if (isOwnerMessageEvent(event)) {
      providerEvents.push(event);
      continue;
    }
    if (isToolResult(event)) {
      providerEvents.push(event);
      continue;
    }
    if (isRecoveryEvent(event)) {
      providerEvents.push(event);
      continue;
    }
    try {
      providerEvents.push(parseAgentStep(event));
    } catch {
      // Future event types stay in the durable event log until the model
      // contract explicitly accepts them.
    }
  }
  return providerEvents;
}

/** Checks whether a durable event is an Owner chat turn that can be replayed to the provider. */
function isOwnerMessageEvent(value: unknown): value is Extract<ModelProviderEvent, { type: "owner_message" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "owner_message" &&
    "content" in value &&
    typeof value.content === "string"
  );
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

/** Checks whether a durable event is a recovery instruction that should be replayed to the provider. */
function isRecoveryEvent(value: unknown): value is Extract<ModelProviderEvent, { type: "recovery" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "recovery" &&
    "reason" in value &&
    typeof value.reason === "string" &&
    "attempt" in value &&
    typeof value.attempt === "number"
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

/** Counts model-authored Agent Steps while excluding non-turn observation and recovery events. */
function countAgentSteps(events: ModelProviderEvent[]): number {
  return events.filter(
    (event) => event.type !== "owner_message" && event.type !== "tool_result" && event.type !== "recovery"
  ).length;
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

/** Emits the Learning Lens note associated with one validated Agent Step. */
function emitLearningLensForStep(input: ContinueTaskRunInput, step: AgentStep): void {
  const note = learningLensNoteForStep(step);
  if (!note) {
    return;
  }
  emitLearningLens(input, note.topic, note.detail);
}

/** Maps Agent Step types to concise learning notes shown only when Learning Lens is enabled. */
function learningLensNoteForStep(step: AgentStep): { topic: string; detail: string } | null {
  if (step.type === "plan") {
    return {
      topic: "planning",
      detail: "Plans make the model's intended path visible before action."
    };
  }
  if (step.type === "tool") {
    return {
      topic: "tool use",
      detail: "Tool steps separate model intent from workspace execution."
    };
  }
  if (step.type === "confirm") {
    return {
      topic: "confirmation",
      detail: "Confirmation steps ask the Owner before a sensitive action proceeds."
    };
  }
  if (step.type === "reflect") {
    return {
      topic: "reflection",
      detail: "Reflection creates a reviewable memory candidate, not durable memory yet."
    };
  }
  return null;
}

/** Writes one Learning Lens log line when the run opted into learning notes. */
function emitLearningLens(input: ContinueTaskRunInput, topic: string, detail: string): void {
  if (!input.learningLens) {
    return;
  }
  input.logStep?.(`[learn] ${topic} - ${detail}`);
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

/** Extracts a stable message from unknown thrown values for recovery logs. */
function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
