import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  isTaskVerdict,
  type HumanVerdictOverride,
  type TaskVerdict
} from "../core/task-verdict.ts";
import { isNotFound } from "./shared.ts";
import { readLatestTaskRun, readTaskRun } from "./task-runs.ts";

export interface RecordHumanVerdictOverrideInput {
  workspace: string;
  id?: string;
  verdict: TaskVerdict;
  reason: string;
}

export type RecordHumanVerdictOverrideResult =
  | {
      status: "recorded";
      id: string;
      runDir: string;
      evaluationPath: string;
      deterministicVerdict: TaskVerdict;
      previousEffectiveVerdict: TaskVerdict;
      effectiveVerdict: TaskVerdict;
      override: HumanVerdictOverride;
      overrideCount: number;
    }
  | { status: "not_found" }
  | { status: "evaluation_not_found"; id: string; runDir: string };

interface EvaluationRecord extends Record<string, unknown> {
  verdict: TaskVerdict;
  effectiveVerdict?: TaskVerdict;
  humanOverrides?: HumanVerdictOverride[];
}

/** Appends an Owner verdict override while preserving the deterministic evaluation. */
export async function recordHumanVerdictOverride(
  input: RecordHumanVerdictOverrideInput
): Promise<RecordHumanVerdictOverrideResult> {
  if (!isTaskVerdict(input.verdict)) {
    throw new Error("Human verdict override verdict must be pass, partial, fail, or blocked");
  }
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new Error("Human verdict override reason must be non-empty");
  }

  const run = input.id
    ? await readTaskRun(input.workspace, input.id)
    : await readLatestTaskRun(input.workspace);
  if (!run) {
    return { status: "not_found" };
  }

  const evaluationPath = join(run.runDir, "evaluation.json");
  const evaluation = await readEvaluationRecord(evaluationPath);
  if (!evaluation) {
    return { status: "evaluation_not_found", id: run.id, runDir: run.runDir };
  }

  const humanOverrides = parseHumanOverrides(evaluation.humanOverrides, evaluation.verdict);
  const previousEffectiveVerdict = readEffectiveVerdict(evaluation, humanOverrides);
  const override: HumanVerdictOverride = {
    previousVerdict: previousEffectiveVerdict,
    verdict: input.verdict,
    reason,
    createdAt: new Date().toISOString()
  };
  const nextOverrides = [...humanOverrides, override];
  const nextEvaluation: EvaluationRecord = {
    ...evaluation,
    effectiveVerdict: input.verdict,
    humanOverrides: nextOverrides
  };
  await writeFile(evaluationPath, `${JSON.stringify(nextEvaluation, null, 2)}\n`, "utf8");

  return {
    status: "recorded",
    id: run.id,
    runDir: run.runDir,
    evaluationPath,
    deterministicVerdict: evaluation.verdict,
    previousEffectiveVerdict,
    effectiveVerdict: input.verdict,
    override,
    overrideCount: nextOverrides.length
  };
}

/** Reads and validates the minimum Evaluation fields needed for an override. */
async function readEvaluationRecord(path: string): Promise<EvaluationRecord | null> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }

  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || !isTaskVerdict(parsed.verdict)) {
    throw new Error("evaluation.json must contain a valid deterministic verdict");
  }
  if ("effectiveVerdict" in parsed && !isTaskVerdict(parsed.effectiveVerdict)) {
    throw new Error("evaluation.json contains an invalid effectiveVerdict");
  }

  return parsed as EvaluationRecord;
}

/** Restores the append-only override history without accepting malformed audit records. */
function parseHumanOverrides(
  value: unknown,
  deterministicVerdict: TaskVerdict
): HumanVerdictOverride[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("evaluation.json humanOverrides must be an array");
  }

  let expectedPreviousVerdict = deterministicVerdict;
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      !isTaskVerdict(entry.previousVerdict) ||
      !isTaskVerdict(entry.verdict) ||
      typeof entry.reason !== "string" ||
      entry.reason.trim().length === 0 ||
      typeof entry.createdAt !== "string" ||
      Number.isNaN(Date.parse(entry.createdAt))
    ) {
      throw new Error("evaluation.json contains an invalid human override");
    }
    if (entry.previousVerdict !== expectedPreviousVerdict) {
      throw new Error("evaluation.json contains a broken human override chain");
    }
    const override = {
      previousVerdict: entry.previousVerdict,
      verdict: entry.verdict,
      reason: entry.reason,
      createdAt: entry.createdAt
    };
    expectedPreviousVerdict = override.verdict;
    return override;
  });
}

/** Resolves the current effective verdict for both legacy and override-aware evaluations. */
function readEffectiveVerdict(
  evaluation: EvaluationRecord,
  overrides: HumanVerdictOverride[]
): TaskVerdict {
  const historyVerdict = overrides.at(-1)?.verdict ?? evaluation.verdict;
  if (evaluation.effectiveVerdict && evaluation.effectiveVerdict !== historyVerdict) {
    throw new Error("evaluation.json effectiveVerdict does not match its human override history");
  }
  return evaluation.effectiveVerdict ?? historyVerdict;
}

/** Checks whether parsed JSON is a plain object before reading evaluation fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
