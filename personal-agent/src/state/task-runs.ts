import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { StructuredSuccessCheck } from "../core/success-check.ts";
import { readLatestCheckpoint } from "./checkpoints.ts";
import { isNotFound } from "./shared.ts";
import { ensureWorkspaceState } from "./workspace.ts";

export type TaskMode = "advisory" | "execution";

export interface CreateTaskRunInput {
  goal: string;
  mode: TaskMode;
  successCheck: string;
  successChecks?: StructuredSuccessCheck[];
}

export interface TaskRunHandle {
  id: string;
  runDir: string;
}

export type TaskRunStatus = "active" | "completed";

export interface TaskRunMetadata {
  id: string;
  goal: string;
  mode: TaskMode;
  successCheck: string;
  successChecks?: StructuredSuccessCheck[];
  status: TaskRunStatus;
  createdAt: string;
  updatedAt: string;
  evaluationVerdict?: string;
  reportPath?: string;
  latestCheckpointId?: string;
  latestCheckpointTurn?: number;
  latestCheckpointCreatedAt?: string;
}

export interface TaskRunRecord extends TaskRunMetadata {
  runDir: string;
}

/** Creates a new Task Run directory with metadata, event log, and latest pointer. */
export async function createTaskRun(
  workspace: string,
  input: CreateTaskRunInput
): Promise<TaskRunHandle> {
  const state = await ensureWorkspaceState(workspace);
  const id = createRunId();
  const runDir = join(state.runsDir, id);
  const checkpointsDir = join(runDir, "checkpoints");
  const now = new Date().toISOString();

  await mkdir(checkpointsDir, { recursive: true });
  await writeFile(
    join(runDir, "run.json"),
    `${JSON.stringify(
      {
        id,
        goal: input.goal,
        mode: input.mode,
        successCheck: input.successCheck,
        ...(input.successChecks && input.successChecks.length > 0 ? { successChecks: input.successChecks } : {}),
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      null,
      2
    )}\n`
  );
  await writeFile(join(runDir, "events.jsonl"), "");
  // `latest` is a tiny pointer file used by resume/history commands without
  // requiring a database in the MVP.
  await writeFile(join(state.runsDir, "latest"), `${id}\n`);

  return { id, runDir };
}

/** Reads the latest Task Run id pointer for a workspace, if one exists. */
export async function readLatestRunId(workspace: string): Promise<string | null> {
  const state = await ensureWorkspaceState(workspace);
  try {
    const value = await readFile(join(state.runsDir, "latest"), "utf8");
    return value.trim() || null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Reads one Task Run metadata record and attaches its run directory path. */
export async function readTaskRun(workspace: string, id: string): Promise<TaskRunRecord | null> {
  const state = await ensureWorkspaceState(workspace);
  const runDir = join(state.runsDir, id);
  const metadata = await readTaskRunMetadata(runDir);
  if (!metadata) {
    return null;
  }
  return { ...metadata, runDir };
}

/** Reads the latest Task Run metadata record for a workspace, if one exists. */
export async function readLatestTaskRun(workspace: string): Promise<TaskRunRecord | null> {
  const id = await readLatestRunId(workspace);
  if (!id) {
    return null;
  }
  return readTaskRun(workspace, id);
}

/** Lists recent Task Runs sorted by most recently updated first. */
export async function listTaskRuns(workspace: string, limit = 20): Promise<TaskRunMetadata[]> {
  const state = await ensureWorkspaceState(workspace);
  const entries = await readdir(state.runsDir, { withFileTypes: true });
  const runs: TaskRunMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = join(state.runsDir, entry.name);
    const metadata = await readTaskRunMetadata(runDir);
    if (metadata) {
      runs.push({
        ...metadata,
        evaluationVerdict: await readTaskRunEvaluationVerdict(runDir),
        reportPath: await readTaskRunReportPath(runDir),
        ...(await readTaskRunLatestCheckpointSummary(runDir))
      });
    }
  }

  // `updatedAt` reflects completion or later status changes, so history shows
  // the runs the Owner most recently touched first.
  return runs
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(0, limit));
}

/** Updates a Task Run status and refreshes its updatedAt timestamp. */
export async function updateTaskRunStatus(runDir: string, status: TaskRunStatus): Promise<void> {
  const path = join(runDir, "run.json");
  const metadata = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  metadata.status = status;
  metadata.updatedAt = new Date().toISOString();
  await writeFile(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

/** Reads raw Task Run metadata from run.json, returning null when missing. */
async function readTaskRunMetadata(runDir: string): Promise<TaskRunMetadata | null> {
  try {
    const metadata = JSON.parse(await readFile(join(runDir, "run.json"), "utf8")) as TaskRunMetadata;
    return metadata;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Reads the optional Task Evaluation verdict used by compact history output. */
async function readTaskRunEvaluationVerdict(runDir: string): Promise<string | undefined> {
  try {
    const evaluation = JSON.parse(await readFile(join(runDir, "evaluation.json"), "utf8")) as Record<string, unknown>;
    return typeof evaluation.verdict === "string" ? evaluation.verdict : undefined;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

/** Returns the Task Report path only when report.md has already been written. */
async function readTaskRunReportPath(runDir: string): Promise<string | undefined> {
  const reportPath = join(runDir, "report.md");
  try {
    await access(reportPath);
    return reportPath;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

/** Reads compact latest-checkpoint metadata for history without exposing full checkpoint state. */
async function readTaskRunLatestCheckpointSummary(
  runDir: string
): Promise<Pick<TaskRunMetadata, "latestCheckpointId" | "latestCheckpointTurn" | "latestCheckpointCreatedAt">> {
  const checkpoint = await readLatestCheckpoint(runDir);
  if (!checkpoint) {
    return {};
  }

  return {
    latestCheckpointId: checkpoint.id,
    latestCheckpointTurn: readCheckpointTurn(checkpoint.state),
    latestCheckpointCreatedAt: checkpoint.createdAt
  };
}

/** Extracts the saved provider turn from a checkpoint state object when present. */
function readCheckpointTurn(state: unknown): number | undefined {
  if (typeof state !== "object" || state === null || !("turn" in state)) {
    return undefined;
  }

  const turn = (state as Record<string, unknown>).turn;
  return typeof turn === "number" ? turn : undefined;
}

/** Creates a filesystem-friendly Task Run id with time ordering and collision resistance. */
function createRunId(): string {
  // Include time for human sorting and a short random suffix to avoid collisions
  // when tests or quick CLI calls create multiple runs in the same millisecond.
  return `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
}
