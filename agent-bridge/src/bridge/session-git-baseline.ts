import { createHash } from "node:crypto";
import { join } from "node:path";
import { STATE_DIR } from "../core/constants.ts";
import type { GitContext, NormalizedHookPayload } from "../core/types.ts";
import { readJson, writeJson } from "../utils/fs.ts";

const BASELINES_FILE = join(STATE_DIR, "session-git-baselines.json");
const MAX_BASELINES = 200;

export interface SessionGitBaseline {
  key: string;
  producer: string;
  cwd: string;
  sessionId: string;
  fingerprint: string;
  updatedAt: string;
}

export async function loadSessionGitBaseline(payload: NormalizedHookPayload): Promise<SessionGitBaseline | null> {
  const baselines = await readBaselines();
  return baselines.find((baseline) => baseline.key === sessionGitBaselineKey(payload)) ?? null;
}

export async function recordSessionGitBaseline(payload: NormalizedHookPayload, git: GitContext): Promise<void> {
  const key = sessionGitBaselineKey(payload);
  const now = new Date().toISOString();
  await writeBaselines([
    {
      key,
      producer: payload.producer,
      cwd: payload.cwd,
      sessionId: payload.sessionId ?? "workspace",
      fingerprint: gitFingerprint(git),
      updatedAt: now
    },
    ...(await readBaselines()).filter((baseline) => baseline.key !== key)
  ]);
}

export function gitFingerprint(git: GitContext): string {
  return createHash("sha256").update(JSON.stringify({
    isGitRepo: git.isGitRepo,
    status: git.status,
    changedFiles: git.changedFiles,
    diff: git.diff,
    stagedDiff: git.stagedDiff,
    untrackedDiff: git.untrackedDiff
  })).digest("hex");
}

export function sessionGitBaselineKey(payload: NormalizedHookPayload): string {
  return createHash("sha1").update(JSON.stringify({
    producer: payload.producer,
    cwd: payload.cwd,
    sessionId: payload.sessionId ?? "workspace"
  })).digest("hex");
}

async function readBaselines(): Promise<SessionGitBaseline[]> {
  const baselines = await readJson<SessionGitBaseline[]>(BASELINES_FILE, []);
  return Array.isArray(baselines) ? baselines : [];
}

async function writeBaselines(baselines: SessionGitBaseline[]): Promise<void> {
  await writeJson(BASELINES_FILE, baselines.slice(0, MAX_BASELINES));
}
