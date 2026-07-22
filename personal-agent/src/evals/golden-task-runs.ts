import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { TaskEvaluation } from "../agent/evaluation.ts";
import { ensureWorkspaceState } from "../state/store.ts";
import {
  runChatGoldenCase,
  runMemoryGoldenCase,
  runReadGoldenCase,
  runResumeGoldenCase,
  runWriteGoldenCase
} from "./golden-workflow-fixtures.ts";
import type { GoldenTaskRunCaseExecution } from "./golden-task-run-shared.ts";
import { runSkillPackGoldenCase } from "./golden-skill-pack-fixture.ts";

export type GoldenTaskRunWorkflow = "read" | "write" | "chat" | "memory" | "resume" | "skill-pack";
export type GoldenTaskRunVerdict = TaskEvaluation["verdict"];
export type GoldenTaskRunEvaluationSource = "task_evaluation" | "skill_pack_eval";

export interface GoldenTaskRunCaseDefinition {
  id: string;
  workflow: GoldenTaskRunWorkflow;
  description: string;
  expectedVerdict: GoldenTaskRunVerdict;
  evaluationSource: GoldenTaskRunEvaluationSource;
}

export interface GoldenTaskRunArtifact {
  label: string;
  path: string;
}

export interface GoldenTaskRunCaseResult extends GoldenTaskRunCaseDefinition {
  status: "passed" | "failed";
  actualVerdict?: GoldenTaskRunVerdict;
  reason?: string;
  taskRunId?: string;
  taskRunDir?: string;
  artifacts: GoldenTaskRunArtifact[];
}

export interface GoldenTaskRunEvalResult {
  status: "completed";
  outputDir: string;
  reportPath: string;
  resultsPath: string;
  passedCount: number;
  failedCount: number;
  cases: GoldenTaskRunCaseResult[];
}

export interface RunGoldenTaskRunEvalsInput {
  workspace: string;
  logStep?: (message: string) => void;
}

/** Defines the stable workflow contract that every golden suite run must reproduce. */
export const goldenTaskRunCaseDefinitions: readonly GoldenTaskRunCaseDefinition[] = [
  {
    id: "read",
    workflow: "read",
    description: "Read a fixture file through the Local Tool loop and verify report and tool evidence.",
    expectedVerdict: "pass",
    evaluationSource: "task_evaluation"
  },
  {
    id: "write",
    workflow: "write",
    description: "Approve a fixture write and verify both the file artifact and successful tool result.",
    expectedVerdict: "pass",
    evaluationSource: "task_evaluation"
  },
  {
    id: "chat",
    workflow: "chat",
    description: "Keep two Owner messages in one Task Run and preserve unavailable task correctness.",
    expectedVerdict: "partial",
    evaluationSource: "task_evaluation"
  },
  {
    id: "memory",
    workflow: "memory",
    description: "Turn a reflection step into a reviewable Memory Suggestion artifact.",
    expectedVerdict: "pass",
    evaluationSource: "task_evaluation"
  },
  {
    id: "resume",
    workflow: "resume",
    description: "Resume an active Task Run from its durable checkpoint and prior plan event.",
    expectedVerdict: "pass",
    evaluationSource: "task_evaluation"
  },
  {
    id: "skill-pack",
    workflow: "skill-pack",
    description: "Discover a fixture Skill Pack and pass its deterministic local eval grader.",
    expectedVerdict: "pass",
    evaluationSource: "skill_pack_eval"
  }
];

/** Runs all core golden workflows in isolated, inspectable local workspaces. */
export async function runGoldenTaskRunEvals(input: RunGoldenTaskRunEvalsInput): Promise<GoldenTaskRunEvalResult> {
  const state = await ensureWorkspaceState(input.workspace);
  const outputDir = join(state.stateDir, "evals", "golden-task-runs", createGoldenEvalRunId());
  const workspacesDir = join(outputDir, "workspaces");
  await mkdir(workspacesDir, { recursive: true });

  const cases: GoldenTaskRunCaseResult[] = [];
  for (const definition of goldenTaskRunCaseDefinitions) {
    const caseWorkspace = join(workspacesDir, definition.id);
    await mkdir(caseWorkspace, { recursive: true });
    cases.push(await runGoldenTaskRunCase(definition, caseWorkspace, input.logStep));
  }

  const passedCount = cases.filter((result) => result.status === "passed").length;
  const reportPath = join(outputDir, "report.md");
  const resultsPath = join(outputDir, "results.json");
  const result: GoldenTaskRunEvalResult = {
    status: "completed",
    outputDir,
    reportPath,
    resultsPath,
    passedCount,
    failedCount: cases.length - passedCount,
    cases
  };

  await writeFile(reportPath, formatGoldenTaskRunReport(result), "utf8");
  await writeFile(resultsPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(join(state.stateDir, "evals", "golden-task-runs", "latest"), `${outputDir}\n`, "utf8");
  return result;
}

/** Executes one workflow fixture and turns exceptions or verdict drift into a failed case. */
async function runGoldenTaskRunCase(
  definition: GoldenTaskRunCaseDefinition,
  workspace: string,
  logStep?: (message: string) => void
): Promise<GoldenTaskRunCaseResult> {
  try {
    const execution = await executeGoldenWorkflow(definition.workflow, workspace, (message) => {
      logStep?.(`[golden:${definition.id}] ${message}`);
    });
    const matchesExpectedVerdict = execution.actualVerdict === definition.expectedVerdict;
    return {
      ...definition,
      status: matchesExpectedVerdict ? "passed" : "failed",
      actualVerdict: execution.actualVerdict,
      reason: matchesExpectedVerdict
        ? undefined
        : `Expected ${definition.expectedVerdict}, received ${execution.actualVerdict}.`,
      taskRunId: execution.taskRunId,
      taskRunDir: execution.taskRunDir,
      artifacts: execution.artifacts
    };
  } catch (error) {
    return {
      ...definition,
      status: "failed",
      reason: readErrorMessage(error),
      artifacts: [{ label: "case workspace", path: workspace }]
    };
  }
}

/** Dispatches a golden definition to the real runtime path for that workflow. */
async function executeGoldenWorkflow(
  workflow: GoldenTaskRunWorkflow,
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  if (workflow === "read") {
    return runReadGoldenCase(workspace, logStep);
  }
  if (workflow === "write") {
    return runWriteGoldenCase(workspace, logStep);
  }
  if (workflow === "chat") {
    return runChatGoldenCase(workspace, logStep);
  }
  if (workflow === "memory") {
    return runMemoryGoldenCase(workspace, logStep);
  }
  if (workflow === "resume") {
    return runResumeGoldenCase(workspace, logStep);
  }
  return runSkillPackGoldenCase(workspace, logStep);
}

/** Formats the persisted human-readable summary with direct artifact paths for failures. */
function formatGoldenTaskRunReport(result: GoldenTaskRunEvalResult): string {
  return [
    "# Golden Task Run Report",
    "",
    `Result: ${result.passedCount} passed, ${result.failedCount} failed`,
    "",
    "## Cases",
    "",
    ...result.cases.flatMap((evalCase) => {
      const status = evalCase.status === "passed" ? "PASS" : "FAIL";
      const lines = [
        `- ${status} ${evalCase.id}`,
        `  - workflow: ${evalCase.workflow}`,
        `  - evaluator: ${evalCase.evaluationSource}`,
        `  - expected: ${evalCase.expectedVerdict}`,
        `  - actual: ${evalCase.actualVerdict ?? "unavailable"}`
      ];
      if (evalCase.reason) {
        lines.push(`  - reason: ${evalCase.reason}`);
      }
      for (const artifact of evalCase.artifacts) {
        lines.push(`  - ${artifact.label}: ${artifact.path}`);
      }
      return lines;
    })
  ].join("\n");
}

/** Generates sortable, collision-resistant output directories without affecting fixture expectations. */
function createGoldenEvalRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `eval-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Converts unknown fixture failures into stable result diagnostics. */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
