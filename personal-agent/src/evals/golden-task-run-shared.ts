import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { TaskEvaluation } from "../agent/evaluation.ts";
import type { ModelProviderEvent } from "../model/provider.ts";
import type {
  GoldenTaskRunArtifact,
  GoldenTaskRunVerdict
} from "./golden-task-runs.ts";

export interface GoldenTaskRunCaseExecution {
  actualVerdict: GoldenTaskRunVerdict;
  taskRunId?: string;
  taskRunDir?: string;
  artifacts: GoldenTaskRunArtifact[];
}

/** Creates the shared execution result shape for workflows graded by Task Evaluation V2. */
export function taskRunExecution(
  taskRunId: string,
  taskRunDir: string,
  actualVerdict: GoldenTaskRunVerdict,
  artifacts: GoldenTaskRunArtifact[]
): GoldenTaskRunCaseExecution {
  return { actualVerdict, taskRunId, taskRunDir, artifacts };
}

/** Reads one persisted Evaluation V2 artifact for golden assertions. */
export async function readTaskEvaluation(runDir: string): Promise<TaskEvaluation> {
  return JSON.parse(await readFile(join(runDir, "evaluation.json"), "utf8")) as TaskEvaluation;
}

/** Finds the latest matching Local Tool observation visible to a deterministic fixture provider. */
export function findToolResultOutput(events: ModelProviderEvent[], tool: string): unknown {
  const event = [...events].reverse().find((candidate) => candidate.type === "tool_result" && candidate.tool === tool);
  return event?.type === "tool_result" ? event.output : undefined;
}

/** Throws a concise fixture failure that the suite records without aborting later cases. */
export function assertGolden(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Checks provider and persisted JSON values before reading fixture-specific fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
