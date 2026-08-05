import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  goldenTaskRunCaseDefinitions,
  runGoldenTaskRunEvals
} from "../../src/evals/golden-task-runs.ts";

/** Reduces persisted result paths to the stable fields used for repeatability checks. */
function stableCaseOutcomes(result: Awaited<ReturnType<typeof runGoldenTaskRunEvals>>) {
  return result.cases.map((evalCase) => ({
    id: evalCase.id,
    source: evalCase.evaluationSource,
    expected: evalCase.expectedVerdict,
    actual: evalCase.actualVerdict,
    status: evalCase.status
  }));
}

test("golden Task Run workflows repeat with stable expected verdicts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-golden-task-runs-"));
  try {
    const first = await runGoldenTaskRunEvals({ workspace });
    const second = await runGoldenTaskRunEvals({ workspace });

    assert.equal(first.passedCount, 7);
    assert.equal(first.failedCount, 0);
    assert.equal(first.cases.length, goldenTaskRunCaseDefinitions.length);
    assert.notEqual(first.outputDir, second.outputDir);
    assert.deepEqual(stableCaseOutcomes(first), stableCaseOutcomes(second));
    assert.deepEqual(
      stableCaseOutcomes(first),
      [
        { id: "read", source: "task_evaluation", expected: "pass", actual: "pass", status: "passed" },
        { id: "write", source: "task_evaluation", expected: "pass", actual: "pass", status: "passed" },
        { id: "tool-error", source: "task_evaluation", expected: "fail", actual: "fail", status: "passed" },
        { id: "chat", source: "task_evaluation", expected: "partial", actual: "partial", status: "passed" },
        { id: "memory", source: "task_evaluation", expected: "pass", actual: "pass", status: "passed" },
        { id: "resume", source: "task_evaluation", expected: "pass", actual: "pass", status: "passed" },
        { id: "skill-pack", source: "skill_pack_eval", expected: "pass", actual: "pass", status: "passed" }
      ]
    );

    const report = await readFile(first.reportPath, "utf8");
    const persisted = JSON.parse(await readFile(first.resultsPath, "utf8"));
    assert.match(report, /Result: 7 passed, 0 failed/);
    assert.match(report, /PASS tool-error/);
    assert.match(report, /PASS chat/);
    assert.match(report, /expected: partial/);
    assert.equal(persisted.failedCount, 0);
    assert.ok(first.cases.every((evalCase) => evalCase.artifacts.length > 0));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
