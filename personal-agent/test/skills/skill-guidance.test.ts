import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  createAuditedSkillPackSummaries,
  loadSkillPackGuidance,
  verifySkillPackGuidanceDigests
} from "../../src/skills/skill-guidance.ts";
import type { SkillPackSummary } from "../../src/skills/skill-packs.ts";

/** Creates the structured summary consumed by the guidance loader in focused tests. */
function createSkillPackSummary(path: string): SkillPackSummary {
  return {
    name: "docs-helper",
    description: "Helps with docs.",
    path,
    source: {
      kind: "workspace",
      label: "workspace",
      root: ".agents/skills",
      priority: 1
    }
  };
}

test("Skill guidance loading returns full UTF-8 content while audit summaries keep only digest metadata", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-guidance-"));
  const relativePath = ".agents/skills/docs-helper/SKILL.md";
  const absolutePath = join(workspace, relativePath);
  const content = "# Docs Helper\n\nFULL GUIDANCE MARKER\n";
  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
    const summary = createSkillPackSummary(relativePath);

    const guidance = await loadSkillPackGuidance(workspace, [summary]);
    const loaded = guidance.get(relativePath);
    const audited = createAuditedSkillPackSummaries([summary], guidance);

    assert.equal(loaded?.content, content);
    assert.equal(loaded?.bytes, Buffer.byteLength(content));
    assert.equal(loaded?.sha256, createHash("sha256").update(content).digest("hex"));
    assert.equal(audited[0]?.guidance.sha256, loaded?.sha256);
    assert.equal("content" in audited[0].guidance, false);
    verifySkillPackGuidanceDigests(guidance, new Map([[relativePath, loaded?.sha256 ?? ""]]));
    assert.throws(
      () => verifySkillPackGuidanceDigests(guidance, new Map([[relativePath, "changed"]])),
      /guidance changed since Task Run started/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Skill guidance loading rejects invalid UTF-8 and oversized instruction files", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-guidance-invalid-"));
  try {
    const invalidPath = ".agents/skills/invalid-helper/SKILL.md";
    const oversizedPath = ".agents/skills/oversized-helper/SKILL.md";
    await mkdir(join(workspace, ".agents/skills/invalid-helper"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/oversized-helper"), { recursive: true });
    await writeFile(join(workspace, invalidPath), Buffer.from([0xc3, 0x28]));
    await writeFile(join(workspace, oversizedPath), Buffer.alloc(64 * 1024 + 1, "a"));

    await assert.rejects(
      loadSkillPackGuidance(workspace, [createSkillPackSummary(invalidPath)]),
      /must be valid UTF-8/
    );
    await assert.rejects(
      loadSkillPackGuidance(workspace, [createSkillPackSummary(oversizedPath)]),
      /exceeds 65536 bytes/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Skill guidance loading bounds the combined context across several valid files", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-guidance-combined-"));
  try {
    const paths = [
      ".agents/skills/first/SKILL.md",
      ".agents/skills/second/SKILL.md",
      ".agents/skills/third/SKILL.md"
    ];
    for (const path of paths) {
      const absolutePath = join(workspace, path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, Buffer.alloc(45_000, "a"));
    }

    await assert.rejects(
      loadSkillPackGuidance(workspace, paths.map(createSkillPackSummary)),
      /Combined Skill Pack guidance exceeds 131072 bytes/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
