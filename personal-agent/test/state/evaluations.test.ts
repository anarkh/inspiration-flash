import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createTaskRun,
  exportTaskRun,
  listTaskRuns,
  recordHumanVerdictOverride,
  writeTaskEvaluation
} from "../../src/state/store.ts";

test("human verdict overrides preserve deterministic evidence and append audit history", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-human-verdict-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "review a failed task",
      mode: "advisory",
      successCheck: "owner reviews the artifacts"
    });
    await writeTaskEvaluation(run.runDir, {
      schemaVersion: 2,
      verdict: "fail",
      effectiveVerdict: "fail",
      humanOverrides: [],
      taskCorrectness: {
        verdict: "fail",
        evidence: [{ source: "workspace", reference: "result.md", detail: "Marker was missing." }],
        checks: []
      }
    });

    const first = await recordHumanVerdictOverride({
      workspace,
      id: run.id,
      verdict: "pass",
      reason: "  Owner inspected result.md and confirmed the intended output.  "
    });
    assert.equal(first.status, "recorded");
    if (first.status !== "recorded") {
      return;
    }
    assert.equal(first.deterministicVerdict, "fail");
    assert.equal(first.previousEffectiveVerdict, "fail");
    assert.equal(first.effectiveVerdict, "pass");
    assert.equal(first.override.reason, "Owner inspected result.md and confirmed the intended output.");
    assert.equal(first.overrideCount, 1);

    const second = await recordHumanVerdictOverride({
      workspace,
      id: run.id,
      verdict: "partial",
      reason: "A later review found one unresolved edge case."
    });
    assert.equal(second.status, "recorded");
    if (second.status !== "recorded") {
      return;
    }
    assert.equal(second.previousEffectiveVerdict, "pass");
    assert.equal(second.effectiveVerdict, "partial");
    assert.equal(second.overrideCount, 2);

    const evaluation = JSON.parse(await readFile(join(run.runDir, "evaluation.json"), "utf8"));
    assert.equal(evaluation.verdict, "fail");
    assert.equal(evaluation.effectiveVerdict, "partial");
    assert.deepEqual(
      evaluation.humanOverrides.map(
        (override: { previousVerdict: string; verdict: string; reason: string }) => ({
          previousVerdict: override.previousVerdict,
          verdict: override.verdict,
          reason: override.reason
        })
      ),
      [
        {
          previousVerdict: "fail",
          verdict: "pass",
          reason: "Owner inspected result.md and confirmed the intended output."
        },
        {
          previousVerdict: "pass",
          verdict: "partial",
          reason: "A later review found one unresolved edge case."
        }
      ]
    );
    assert.ok(evaluation.humanOverrides.every((override: { createdAt: string }) => !Number.isNaN(Date.parse(override.createdAt))));

    const history = await listTaskRuns(workspace);
    assert.equal(history[0]?.evaluationVerdict, "partial");
    assert.equal(history[0]?.deterministicEvaluationVerdict, "fail");
    assert.equal(history[0]?.humanOverrideCount, 2);

    const exported = await exportTaskRun(workspace, run.id);
    assert.ok(exported);
    assert.match(await readFile(exported.path, "utf8"), /A later review found one unresolved edge case/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("human verdict override reports missing runs and missing evaluations without creating audit data", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-human-verdict-missing-"));
  try {
    assert.deepEqual(
      await recordHumanVerdictOverride({
        workspace,
        verdict: "pass",
        reason: "No run exists yet."
      }),
      { status: "not_found" }
    );

    const run = await createTaskRun(workspace, {
      goal: "active task",
      mode: "advisory",
      successCheck: "not evaluated yet"
    });
    assert.deepEqual(
      await recordHumanVerdictOverride({
        workspace,
        id: run.id,
        verdict: "blocked",
        reason: "The task is still active."
      }),
      { status: "evaluation_not_found", id: run.id, runDir: run.runDir }
    );

    await writeTaskEvaluation(run.runDir, { verdict: "partial" });
    const legacy = await recordHumanVerdictOverride({
      workspace,
      id: run.id,
      verdict: "pass",
      reason: "Legacy evaluation was reviewed."
    });
    assert.equal(legacy.status, "recorded");
    if (legacy.status === "recorded") {
      assert.equal(legacy.deterministicVerdict, "partial");
      assert.equal(legacy.previousEffectiveVerdict, "partial");
      assert.equal(legacy.effectiveVerdict, "pass");
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("human verdict override rejects inconsistent audit history", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-human-verdict-invalid-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "inspect a corrupted audit",
      mode: "advisory",
      successCheck: "audit remains trustworthy"
    });
    await writeTaskEvaluation(run.runDir, {
      verdict: "fail",
      effectiveVerdict: "pass",
      humanOverrides: []
    });

    await assert.rejects(
      recordHumanVerdictOverride({
        workspace,
        id: run.id,
        verdict: "partial",
        reason: "Do not append to an inconsistent history."
      }),
      /effectiveVerdict does not match its human override history/
    );

    const evaluation = JSON.parse(await readFile(join(run.runDir, "evaluation.json"), "utf8"));
    assert.equal(evaluation.effectiveVerdict, "pass");
    assert.deepEqual(evaluation.humanOverrides, []);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
