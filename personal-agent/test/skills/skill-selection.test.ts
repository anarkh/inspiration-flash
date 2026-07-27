import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { selectExplicitSkillPackMatches } from "../../src/skills/skill-selection.ts";

/** Writes a minimal Skill Pack whose body identifies its source during assertions. */
async function writeSkillPack(root: string, name: string, marker: string): Promise<string> {
  const directory = join(root, name);
  const path = join(directory, "SKILL.md");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path,
    [
      "---",
      `name: ${name}`,
      `description: ${marker}`,
      "---",
      "",
      `# ${marker}`
    ].join("\n"),
    "utf8"
  );
  return path;
}

test("explicit Skill selection uses precedence for plain names and can override it by source", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-selection-"));
  const userRoot = await mkdtemp(join(tmpdir(), "personal-agent-user-skills-"));
  try {
    const workspaceRoot = join(workspace, ".agents/skills");
    await writeSkillPack(workspaceRoot, "docs-helper", "workspace marker");
    const userPath = await writeSkillPack(userRoot, "docs-helper", "user marker");
    const input = {
      workspace,
      goal: "summarize docs",
      sourceOptions: {
        userSkillsRoot: userRoot,
        packageSkillsRoot: null,
        configuredRoots: []
      }
    };

    const winner = await selectExplicitSkillPackMatches({ ...input, skillSelectors: ["docs-helper"] });
    const overridden = await selectExplicitSkillPackMatches({
      ...input,
      skillSelectors: ["user:docs-helper"]
    });

    assert.equal(winner[0]?.source.kind, "workspace");
    assert.equal(winner[0]?.selection?.precedenceOverridden, false);
    assert.equal(overridden[0]?.path, userPath);
    assert.equal(overridden[0]?.source.kind, "user");
    assert.equal(overridden[0]?.selection?.selector, "user:docs-helper");
    assert.equal(overridden[0]?.selection?.precedenceOverridden, true);
    assert.equal(overridden[0]?.conflicts?.[0]?.source.kind, "workspace");
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(userRoot, { recursive: true, force: true });
  }
});

test("explicit Skill selection accepts configured aliases and exact displayed paths", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-configured-"));
  const configuredRoot = await mkdtemp(join(tmpdir(), "personal-agent-configured-skills-"));
  try {
    const configuredPath = await writeSkillPack(configuredRoot, "portable-helper", "configured marker");
    const input = {
      workspace,
      goal: "use portable helper",
      sourceOptions: {
        userSkillsRoot: null,
        packageSkillsRoot: null,
        configuredRoots: [configuredRoot]
      }
    };

    const qualified = await selectExplicitSkillPackMatches({
      ...input,
      skillSelectors: ["configured:1:portable-helper"]
    });
    const exact = await selectExplicitSkillPackMatches({
      ...input,
      skillSelectors: [configuredPath]
    });

    assert.equal(qualified[0]?.path, configuredPath);
    assert.equal(qualified[0]?.source.label, "configured[1]");
    assert.equal(exact[0]?.path, configuredPath);
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(configuredRoot, { recursive: true, force: true });
  }
});

test("explicit Skill selection rejects missing, excessive, and duplicate-source variants", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-errors-"));
  const userRoot = await mkdtemp(join(tmpdir(), "personal-agent-user-skill-errors-"));
  try {
    await writeSkillPack(join(workspace, ".agents/skills"), "docs-helper", "workspace marker");
    await writeSkillPack(userRoot, "docs-helper", "user marker");
    const input = {
      workspace,
      goal: "summarize docs",
      sourceOptions: {
        userSkillsRoot: userRoot,
        packageSkillsRoot: null,
        configuredRoots: []
      }
    };

    await assert.rejects(
      selectExplicitSkillPackMatches({ ...input, skillSelectors: ["missing-helper"] }),
      /Skill Pack not found: missing-helper/
    );
    await assert.rejects(
      selectExplicitSkillPackMatches({
        ...input,
        skillSelectors: ["workspace:docs-helper", "user:docs-helper"]
      }),
      /cannot load multiple source variants of docs-helper/
    );
    await assert.rejects(
      selectExplicitSkillPackMatches({
        ...input,
        skillSelectors: ["one", "two", "three", "four", "five"]
      }),
      /at most 4 selectors/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(userRoot, { recursive: true, force: true });
  }
});
