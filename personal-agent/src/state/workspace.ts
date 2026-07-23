import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { isNotFound } from "./shared.ts";

export interface WorkspaceState {
  workspace: string;
  stateDir: string;
  runsDir: string;
}

/** Ensures the workspace state directories and default state files exist. */
export async function ensureWorkspaceState(workspace: string): Promise<WorkspaceState> {
  const stateDir = join(workspace, ".personal-agent");
  const runsDir = join(stateDir, "runs");
  await mkdir(runsDir, { recursive: true });

  // Defaults are written only once so later Owner edits to config or memory are
  // never overwritten by another command invocation.
  await writeDefaultFile(
    join(stateDir, "config.json"),
    `${JSON.stringify(
      { modelProvider: "deepseek", model: "deepseek-v4-flash", learningLens: false, skillRoots: [] },
      null,
      2
    )}\n`
  );
  await writeDefaultFile(
    join(stateDir, "memory.md"),
    "# Project Memory\n\n## Stable Facts\n\n## Preferences\n\n## Project Conventions\n\n## Open Threads\n"
  );

  return { workspace, stateDir, runsDir };
}

/** Writes a default file only when the Owner has not created or edited it yet. */
async function writeDefaultFile(path: string, content: string): Promise<void> {
  try {
    await access(path, constants.F_OK);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
    // Missing files are initialized lazily; all other filesystem errors should
    // surface because they likely indicate permissions or disk problems.
    await writeFile(path, content);
  }
}
