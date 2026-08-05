import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resumeLatestTask, runChatTask, runTask } from "../agent/runner.ts";
import type { ModelProvider } from "../model/provider.ts";
import { appendRunEvent, createTaskRun, writeCheckpoint } from "../state/store.ts";
import {
  assertGolden,
  findToolResultOutput,
  isRecord,
  readTaskEvaluation,
  taskRunExecution,
  type GoldenTaskRunCaseExecution
} from "./golden-task-run-shared.ts";

const readMarker = "golden-read-marker";
const toolErrorMarker = "golden-tool-error-marker";
const writeMarker = "golden-write-marker";
const memoryMarker = "Owner prefers deterministic golden evaluations.";
const resumeMarker = "golden-resume-marker";

/** Exercises a deterministic read_file plan-act-observe loop. */
export async function runReadGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const fixturePath = join(workspace, "fixture.md");
  await writeFile(fixturePath, `${readMarker}\n`, "utf8");
  const provider: ModelProvider = {
    name: "golden-read",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Read the fixture", steps: ["Call read_file", "Report the marker"] };
      }
      if (input.turn === 2) {
        return { type: "tool", tool: "read_file", input: { path: "fixture.md" } };
      }
      const output = findToolResultOutput(input.events, "read_file");
      assertGolden(typeof output === "string", "read_file did not produce string output.");
      return { type: "finish", report: `Read fixture: ${output.trim()}` };
    }
  };
  const run = await runTask({
    workspace,
    goal: "Read the golden fixture file.",
    mode: "advisory",
    successCheck: "Read the fixture and report its marker.",
    successChecks: [
      { id: "read-report", type: "report_contains", value: readMarker },
      { id: "read-tool", type: "tool_succeeded", tool: "read_file" }
    ],
    provider,
    logStep
  });
  const evaluation = await readTaskEvaluation(run.runDir);
  return taskRunExecution(run.id, run.runDir, evaluation.verdict, [
    { label: "fixture", path: fixturePath },
    { label: "report", path: join(run.runDir, "report.md") },
    { label: "evaluation", path: join(run.runDir, "evaluation.json") }
  ]);
}

/** Exercises schema rejection, durable tool_error evidence, and provider recovery. */
export async function runToolErrorGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const provider: ModelProvider = {
    name: "golden-tool-error",
    /** Produces one malformed call, then verifies the durable observation before finishing. */
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: {} };
      }
      const output = findToolResultOutput(input.events, "read_file");
      assertGolden(
        isRecord(output) && output.type === "tool_error" && output.phase === "input_validation",
        "Malformed read_file input did not produce an input_validation tool_error."
      );
      return { type: "finish", report: `Recorded expected validation failure: ${toolErrorMarker}` };
    }
  };
  const run = await runTask({
    workspace,
    goal: "Record a malformed Local Tool call without executing it.",
    mode: "advisory",
    successCheck: "Persist the validation failure and mark the tool call unsuccessful.",
    successChecks: [
      { id: "tool-error-report", type: "report_contains", value: toolErrorMarker },
      { id: "tool-error-unsuccessful", type: "tool_succeeded", tool: "read_file" }
    ],
    provider,
    logStep
  });
  const evaluation = await readTaskEvaluation(run.runDir);
  assertGolden(evaluation.verdict === "fail", `Expected failed tool correctness, received ${evaluation.verdict}.`);
  return taskRunExecution(run.id, run.runDir, evaluation.verdict, [
    { label: "events", path: join(run.runDir, "events.jsonl") },
    { label: "report", path: join(run.runDir, "report.md") },
    { label: "evaluation", path: join(run.runDir, "evaluation.json") }
  ]);
}

/** Exercises a confirmed write_file action and artifact-backed correctness checks. */
export async function runWriteGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const outputPath = join(workspace, "result.md");
  const provider: ModelProvider = {
    name: "golden-write",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Write the result", steps: ["Call write_file", "Verify the tool result"] };
      }
      if (input.turn === 2) {
        return { type: "tool", tool: "write_file", input: { path: "result.md", content: `${writeMarker}\n` } };
      }
      const output = findToolResultOutput(input.events, "write_file");
      assertGolden(isRecord(output) && output.type === "file_written", "write_file did not produce file_written.");
      return { type: "finish", report: `Wrote result.md with ${writeMarker}.` };
    }
  };
  const run = await runTask({
    workspace,
    goal: "Write the golden result file.",
    mode: "execution",
    successCheck: "Write result.md with the expected marker.",
    successChecks: [
      { id: "write-file", type: "file_contains", path: "result.md", value: writeMarker },
      { id: "write-tool", type: "tool_succeeded", tool: "write_file" }
    ],
    provider,
    logStep,
    confirmAction(request) {
      return request.tool === "write_file";
    }
  });
  const evaluation = await readTaskEvaluation(run.runDir);
  assertGolden((await readFile(outputPath, "utf8")).includes(writeMarker), "Written fixture is missing its marker.");
  return taskRunExecution(run.id, run.runDir, evaluation.verdict, [
    { label: "written file", path: outputPath },
    { label: "report", path: join(run.runDir, "report.md") },
    { label: "evaluation", path: join(run.runDir, "evaluation.json") }
  ]);
}

/** Exercises persistent chat while preserving the expected unavailable correctness verdict. */
export async function runChatGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const replies: string[] = [];
  const provider: ModelProvider = {
    name: "golden-chat",
    async nextStep(input) {
      const ownerMessages = input.events.filter((event) => event.type === "owner_message");
      return {
        type: "message",
        content: ownerMessages.length === 1 ? "Golden chat reply one." : "Golden chat reply two."
      };
    }
  };
  const run = await runChatTask({
    workspace,
    provider,
    messages: ["Golden owner message one.", "Golden owner message two."],
    logStep,
    onAgentMessage(message) {
      replies.push(message);
    }
  });
  const evaluation = await readTaskEvaluation(run.runDir);
  assertGolden(replies.length === 2, `Expected 2 chat replies, received ${replies.length}.`);
  assertGolden(
    evaluation.taskCorrectness.verdict === "unavailable",
    `Expected unavailable chat correctness, received ${evaluation.taskCorrectness.verdict}.`
  );
  return taskRunExecution(run.id, run.runDir, evaluation.verdict, [
    { label: "events", path: join(run.runDir, "events.jsonl") },
    { label: "report", path: join(run.runDir, "report.md") },
    { label: "evaluation", path: join(run.runDir, "evaluation.json") }
  ]);
}

/** Exercises reflection-to-suggestion conversion without mutating Project Memory. */
export async function runMemoryGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const provider: ModelProvider = {
    name: "golden-memory",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Capture a memory candidate", steps: ["Reflect", "Finish"] };
      }
      if (input.turn === 2) {
        return { type: "reflect", section: "preferences", note: memoryMarker };
      }
      return { type: "finish", report: "Created one reviewable memory suggestion." };
    }
  };
  const run = await runTask({
    workspace,
    goal: "Create a golden Memory Suggestion.",
    mode: "advisory",
    successCheck: "Create a reviewable memory suggestion.",
    successChecks: [{ id: "memory-report", type: "report_contains", value: "memory suggestion" }],
    provider,
    logStep
  });
  const suggestionsPath = join(run.runDir, "memory-suggestions.json");
  const suggestions = JSON.parse(await readFile(suggestionsPath, "utf8")) as unknown;
  assertGolden(
    Array.isArray(suggestions) && suggestions.some((item) => isRecord(item) && item.note === memoryMarker),
    "Memory Suggestion artifact is missing the golden note."
  );
  const evaluation = await readTaskEvaluation(run.runDir);
  assertGolden(
    evaluation.learningSignals.includes("Project Memory suggestion"),
    "Evaluation is missing the Project Memory learning signal."
  );
  return taskRunExecution(run.id, run.runDir, evaluation.verdict, [
    { label: "memory suggestions", path: suggestionsPath },
    { label: "report", path: join(run.runDir, "report.md") },
    { label: "evaluation", path: join(run.runDir, "evaluation.json") }
  ]);
}

/** Exercises checkpoint replay and completion of an already active Task Run. */
export async function runResumeGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const initialRun = await createTaskRun(workspace, {
    goal: "Resume the golden Task Run.",
    mode: "advisory",
    successCheck: "Resume and report the expected marker.",
    successChecks: [{ id: "resume-report", type: "report_contains", value: resumeMarker }]
  });
  await appendRunEvent(initialRun.runDir, {
    type: "plan",
    summary: "Pause before completion",
    steps: ["Resume from checkpoint"]
  });
  await writeCheckpoint(initialRun.runDir, {
    goal: "Resume the golden Task Run.",
    mode: "advisory",
    turn: 1,
    eventCount: 1
  });

  const provider: ModelProvider = {
    name: "golden-resume",
    async nextStep(input) {
      assertGolden(input.turn === 2, `Expected resumed turn 2, received ${input.turn}.`);
      assertGolden(input.events.some((event) => event.type === "plan"), "Resumed provider did not receive the prior plan.");
      return { type: "finish", report: `Resumed successfully: ${resumeMarker}` };
    }
  };
  const resumed = await resumeLatestTask({ workspace, provider, logStep });
  assertGolden(resumed.status === "completed", `Expected a completed resumed run, received ${resumed.status}.`);
  const evaluation = await readTaskEvaluation(resumed.runDir);
  return taskRunExecution(resumed.id, resumed.runDir, evaluation.verdict, [
    { label: "checkpoint", path: join(resumed.runDir, "checkpoints") },
    { label: "report", path: join(resumed.runDir, "report.md") },
    { label: "evaluation", path: join(resumed.runDir, "evaluation.json") }
  ]);
}
