import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ModelProvider } from "../model/provider.ts";
import { runSkillPackEvals } from "../skills/evals.ts";
import {
  assertGolden,
  readTaskEvaluation,
  type GoldenTaskRunCaseExecution
} from "./golden-task-run-shared.ts";

const skillPackMarker = "golden-skill-pack-marker";

/** Exercises Skill Pack discovery, context injection, Task Run execution, and deterministic grading. */
export async function runSkillPackGoldenCase(
  workspace: string,
  logStep: (message: string) => void
): Promise<GoldenTaskRunCaseExecution> {
  const skillDir = join(workspace, ".agents", "skills", "golden-helper");
  const evalsDir = join(skillDir, "evals");
  await mkdir(evalsDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    [
      "---",
      "name: golden-helper",
      "description: Produces the marker used by the Golden Task Run Skill Pack fixture.",
      "---",
      "",
      "# Golden Helper",
      "",
      `Return ${skillPackMarker} when this fixture is evaluated.`
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(evalsDir, "evals.json"),
    `${JSON.stringify(
      {
        skill_name: "golden-helper",
        evals: [
          {
            id: "golden-marker",
            prompt: "Use the fixture skill and return its marker.",
            expected_output: skillPackMarker
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const provider: ModelProvider = {
    name: "golden-skill-pack",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Use the selected Skill Pack", steps: ["Read guidance", "Return marker"] };
      }
      assertGolden(input.skillPacks?.includes("golden-helper") === true, "Fixture Skill Pack was not injected.");
      return { type: "finish", report: `Skill Pack output: ${skillPackMarker}` };
    }
  };
  const evalResult = await runSkillPackEvals({
    workspace,
    skillPack: "golden-helper",
    provider,
    logStep
  });
  const evalCase = evalResult.cases[0];
  assertGolden(evalResult.passedCount === 1 && evalResult.failedCount === 0, "Fixture Skill Pack eval did not pass.");
  assertGolden(evalCase?.taskRunDir !== undefined, "Fixture Skill Pack eval did not preserve its Task Run.");
  const nestedEvaluation = await readTaskEvaluation(evalCase.taskRunDir);
  assertGolden(
    nestedEvaluation.taskCorrectness.verdict === "unavailable",
    "Skill Pack grader must remain distinct from the underlying Task Evaluation."
  );
  return {
    actualVerdict: "pass",
    taskRunId: evalCase.taskRunId,
    taskRunDir: evalCase.taskRunDir,
    artifacts: [
      { label: "skill", path: join(skillDir, "SKILL.md") },
      { label: "eval manifest", path: join(evalsDir, "evals.json") },
      { label: "skill eval report", path: evalResult.reportPath },
      { label: "skill eval results", path: evalResult.resultsPath },
      { label: "task evaluation", path: join(evalCase.taskRunDir, "evaluation.json") }
    ]
  };
}
