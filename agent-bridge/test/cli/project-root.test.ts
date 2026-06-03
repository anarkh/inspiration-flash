import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCodexWorktreeProjectRoot, resolveHookConfigCwd } from "../../src/cli/project-root.ts";

test("project hook cwd stays unchanged for ordinary directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-project-root-"));
  try {
    assert.equal(await resolveHookConfigCwd("project", dir), dir);
    assert.equal(await resolveHookConfigCwd("global", dir), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("project hook cwd resolves Codex worktrees back to the real project root", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-project-root-"));
  try {
    const realProject = join(dir, "real-project");
    const worktree = join(dir, ".codex", "worktrees", "abcd", "real-project");
    const nested = join(worktree, "packages", "tool");
    await mkdir(join(realProject, ".git", "worktrees", "real-project"), { recursive: true });
    await mkdir(nested, { recursive: true });
    await writeFile(join(worktree, ".git"), `gitdir: ${join(realProject, ".git", "worktrees", "real-project")}\n`, "utf8");

    assert.equal(await resolveCodexWorktreeProjectRoot(nested), realProject);
    assert.equal(await resolveHookConfigCwd("project", nested), realProject);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("project hook cwd leaves regular git worktrees unchanged", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-bridge-project-root-"));
  try {
    const realProject = join(dir, "real-project");
    const worktree = join(dir, "feature-worktree");
    await mkdir(join(realProject, ".git", "worktrees", "feature-worktree"), { recursive: true });
    await mkdir(worktree, { recursive: true });
    await writeFile(join(worktree, ".git"), `gitdir: ${join(realProject, ".git", "worktrees", "feature-worktree")}\n`, "utf8");

    assert.equal(await resolveCodexWorktreeProjectRoot(worktree), null);
    assert.equal(await resolveHookConfigCwd("project", worktree), worktree);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
