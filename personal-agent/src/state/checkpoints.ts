import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isNotFound } from "./shared.ts";

export interface CheckpointHandle {
  id: string;
  path: string;
}

export interface StoredCheckpoint {
  id: string;
  createdAt: string;
  state: unknown;
}

/** Writes one checkpoint JSON file for a Task Run and returns its handle. */
export async function writeCheckpoint(runDir: string, state: unknown): Promise<CheckpointHandle> {
  const checkpointsDir = join(runDir, "checkpoints");
  await mkdir(checkpointsDir, { recursive: true });
  // Timestamp ids are sufficient for the single-active-run MVP and keep
  // checkpoint ordering obvious when browsing the filesystem.
  const id = `${Date.now()}`;
  const path = join(checkpointsDir, `${id}.json`);
  await writeFile(
    path,
    `${JSON.stringify({ id, createdAt: new Date().toISOString(), state }, null, 2)}\n`
  );
  return { id, path };
}

/** Reads a specific checkpoint JSON file from a Task Run directory. */
export async function readCheckpoint(runDir: string, id: string): Promise<StoredCheckpoint> {
  const content = await readFile(join(runDir, "checkpoints", `${id}.json`), "utf8");
  return JSON.parse(content) as StoredCheckpoint;
}

/** Returns the newest checkpoint for a Task Run, or null when none exists. */
export async function readLatestCheckpoint(runDir: string): Promise<StoredCheckpoint | null> {
  try {
    const entries = await readdir(join(runDir, "checkpoints"), { withFileTypes: true });
    const ids = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -".json".length))
      .sort();

    const id = ids.at(-1);
    return id ? readCheckpoint(runDir, id) : null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}
