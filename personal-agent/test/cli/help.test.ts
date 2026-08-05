import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  appendProjectMemory,
  appendRunEvent,
  createTaskRun,
  readCheckpoint,
  updateTaskRunStatus,
  writeCheckpoint,
  writeMemorySuggestions,
  writeTaskEvaluation,
  writeTaskReport
} from "../../src/state/store.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Gives filesystem-backed history tests distinct updatedAt timestamps. */
async function waitForDistinctTimestamp(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

test("cli prints help", () => {
  const result = spawnSync(process.execPath, ["./src/cli/index.ts", "--help"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /a-agent/);
  assert.match(
    result.stdout,
    /run \[--learn\] \[--review\] \[--skill <name-or-path>\]\.\.\. \[--check <json>\]\.\.\. <task>/
  );
  assert.match(result.stdout, /start \[--learn\] \[--review\] \[--skill <name-or-path>\]\.\.\./);
  assert.match(result.stdout, /chat \[--learn\] \[--review\] \[--skill <name-or-path>\]\.\.\./);
  assert.match(result.stdout, /resume \[--learn\] \[--review\]/);
  assert.match(result.stdout, /memory append \[--section <section>\] <note>/);
  assert.match(result.stdout, /memory apply-suggestions \[--yes\] \[run-id\]/);
  assert.match(result.stdout, /eval golden/);
  assert.match(result.stdout, /eval override \[run-id\] --verdict <pass\|partial\|fail\|blocked> --reason <text>/);
  assert.match(result.stdout, /eval skill-pack <name-or-path>/);
  assert.match(result.stdout, /export \[run-id\]/);
  assert.match(result.stdout, /history \[--status <active\|completed>\] \[--limit <count>\] \[--offset <count>\]/);
});

test("package exposes the renamed npm package and a-agent binary", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  assert.equal(manifest.name, "@ranarkh/agent");
  assert.deepEqual(manifest.bin, { "a-agent": "dist/cli/index.js" });
});

test("cli runs when invoked through an installed binary symlink", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-symlink-"));
  try {
    const binary = join(workspace, "a-agent");
    await symlink(join(root, "src/cli/index.ts"), binary);

    const result = spawnSync(process.execPath, [binary, "--help"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /a-agent/);
    assert.match(
      result.stdout,
      /run \[--learn\] \[--review\] \[--skill <name-or-path>\]\.\.\. \[--check <json>\]\.\.\. <task>/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli eval skill-pack runs a local Skill Pack eval manifest", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-eval-skill-pack-"));
  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper/evals"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps answer documentation questions.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/evals/evals.json"),
      JSON.stringify(
        {
          skill_name: "docs-helper",
          evals: [
            {
              id: "bootstrap",
              prompt: "Run the bootstrap eval.",
              expected_output: "Outcome: The task was accepted into the Personal Agent loop"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "eval", "skill-pack", "docs-helper"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Evaluated Skill Pack docs-helper: 1 passed, 0 failed/);
    assert.match(result.stdout, /Report:/);
    assert.match(result.stderr, /\[agent\] turn 1 plan/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli eval golden runs every deterministic core workflow", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-eval-golden-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "eval", "golden"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Golden Task Runs: 7 passed, 0 failed/);
    assert.match(result.stdout, /chat: passed \| expected partial \| actual partial/);
    assert.match(result.stdout, /skill-pack: passed \| expected pass \| actual pass/);
    assert.match(result.stdout, /tool-error: passed \| expected fail \| actual fail/);
    assert.match(result.stderr, /\[golden:read\] \[agent\] turn 1 plan/);

    const latestPath = join(workspace, ".personal-agent/evals/golden-task-runs/latest");
    const latest = (await readFile(latestPath, "utf8")).trim();
    const persisted = JSON.parse(await readFile(join(latest, "results.json"), "utf8"));
    assert.equal(persisted.passedCount, 7);
    assert.equal(persisted.failedCount, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli eval override records an audited effective verdict and exposes it in history", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-eval-override-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "review generated summary",
      mode: "advisory",
      successCheck: "summary is correct"
    });
    await writeTaskEvaluation(run.runDir, {
      schemaVersion: 2,
      verdict: "fail",
      effectiveVerdict: "fail",
      humanOverrides: []
    });
    await updateTaskRunStatus(run.runDir, "completed");

    const override = spawnSync(
      process.execPath,
      [
        join(root, "src/cli/index.ts"),
        "eval",
        "override",
        run.id,
        "--verdict",
        "pass",
        "--reason",
        "Owner inspected the generated summary."
      ],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(override.status, 0, override.stderr);
    assert.match(override.stdout, /Deterministic verdict: fail/);
    assert.match(override.stdout, /Previous effective verdict: fail/);
    assert.match(override.stdout, /Effective verdict: pass/);
    assert.match(override.stdout, /Reason: Owner inspected the generated summary/);

    const evaluation = JSON.parse(await readFile(join(run.runDir, "evaluation.json"), "utf8"));
    assert.equal(evaluation.verdict, "fail");
    assert.equal(evaluation.effectiveVerdict, "pass");
    assert.equal(evaluation.humanOverrides.length, 1);

    const history = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "history"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });
    assert.equal(history.status, 0, history.stderr);
    assert.match(history.stdout, /evaluation: pass \(human override; deterministic: fail\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli eval override requires both a valid verdict and an audit reason", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-eval-override-invalid-"));
  try {
    const invalidVerdict = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "eval", "override", "--verdict", "maybe", "--reason", "manual review"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: { ...process.env, PERSONAL_AGENT_SKIP_DOTENV: "1" }
      }
    );
    assert.equal(invalidVerdict.status, 1);
    assert.match(invalidVerdict.stderr, /--verdict must be pass, partial, fail, or blocked/);

    const missingReason = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "eval", "override", "--verdict", "pass"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: { ...process.env, PERSONAL_AGENT_SKIP_DOTENV: "1" }
      }
    );
    assert.equal(missingReason.status, 1);
    assert.match(missingReason.stderr, /requires --reason <text>/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run completes a bootstrap Task Run in the current workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Completed Task Run/);
    assert.match(result.stderr, /\[agent\] turn 1 plan - Create a minimal Task Plan/);
    assert.match(result.stderr, /\[agent\] turn 2 finish - # Task Report/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );
    const report = await readFile(join(workspace, ".personal-agent/runs", latest, "report.md"), "utf8");
    const evaluation = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "evaluation.json"), "utf8")
    );

    assert.equal(metadata.goal, "summarize docs");
    assert.equal(metadata.status, "completed");
    assert.match(report, /summarize docs/);
    assert.equal(evaluation.verdict, "partial");
    assert.equal(evaluation.taskCorrectness.verdict, "unavailable");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run explicitly selects a configured Skill source and records its guidance digest", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-explicit-skill-"));
  const configuredRoot = await mkdtemp(join(tmpdir(), "personal-agent-cli-configured-skills-"));
  const guidanceMarker = "CLI FULL GUIDANCE MARKER";
  try {
    await mkdir(join(workspace, ".personal-agent"), { recursive: true });
    await mkdir(join(configuredRoot, "portable-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".personal-agent/config.json"),
      `${JSON.stringify({ skillRoots: [configuredRoot] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(configuredRoot, "portable-helper/SKILL.md"),
      [
        "---",
        "name: portable-helper",
        "description: Helps with portable tasks.",
        "---",
        "",
        guidanceMarker
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [
        join(root, "src/cli/index.ts"),
        "run",
        "--skill",
        "configured:1:portable-helper",
        "use portable guidance"
      ],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const runDir = join(workspace, ".personal-agent/runs", latest);
    const metadata = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
    const events = await readFile(join(runDir, "events.jsonl"), "utf8");

    assert.deepEqual(metadata.skillSelectors, ["configured:1:portable-helper"]);
    assert.deepEqual(metadata.selectedSkillPaths, [join(configuredRoot, "portable-helper/SKILL.md")]);
    assert.match(events, /"guidance":\{"sha256":"[a-f0-9]{64}","bytes":\d+\}/);
    assert.doesNotMatch(events, new RegExp(guidanceMarker));
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(configuredRoot, { recursive: true, force: true });
  }
});

test("cli run reports an unknown explicit Skill without creating Task Run state", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-missing-skill-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "run", "--skill", "missing-helper", "summarize docs"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /a-agent: run failed: Skill Pack not found: missing-helper/);
    await assert.rejects(readFile(join(workspace, ".personal-agent/runs/latest"), "utf8"), /ENOENT/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run accepts a structured Success Check and records its evidence", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-success-check-"));
  try {
    const check = JSON.stringify({ id: "goal", type: "report_contains", value: "summarize docs" });
    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "run", "--check", check, "summarize docs"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /evaluation: pass/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );
    const evaluation = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "evaluation.json"), "utf8")
    );

    assert.deepEqual(metadata.successChecks, [
      { id: "goal", type: "report_contains", value: "summarize docs" }
    ]);
    assert.equal(evaluation.taskCorrectness.verdict, "pass");
    assert.equal(evaluation.taskCorrectness.checks[0].evidence[0].reference, "report.md");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run returns a failure exit code when an objective Success Check fails", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-success-check-fail-"));
  try {
    const check = JSON.stringify({ type: "file_exists", path: "missing-result.md" });
    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "run", "--check", check, "summarize docs"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Completed Task Run/);
    assert.match(result.stdout, /evaluation: fail/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const evaluation = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "evaluation.json"), "utf8")
    );
    assert.equal(evaluation.executionIntegrity.verdict, "pass");
    assert.equal(evaluation.taskCorrectness.verdict, "fail");
    assert.equal(evaluation.verdict, "fail");
    assert.equal(evaluation.taskCorrectness.checks[0].evidence[0].reference, "missing-result.md");
    assert.equal(evaluation.taskCorrectness.checks[0].evidence[0].detail, "Expected file does not exist.");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli chat keeps multiple inputs in one persistent Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-chat-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "chat"], {
      cwd: workspace,
      encoding: "utf8",
      input: ["你好", "结束"].join("\n"),
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Bootstrap provider cannot answer with a real model/);
    assert.match(result.stdout, /Completed Chat Task Run/);
    assert.match(result.stderr, /Chat> /);
    assert.match(result.stderr, /\[agent\] provider bootstrap \(deterministic-bootstrap\)/);
    assert.match(result.stderr, /\[agent\] turn 1 message - Bootstrap provider cannot answer/);
    assert.match(result.stderr, /\[agent\] turn 3 finish - # Chat Report/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );
    const events = await readFile(join(workspace, ".personal-agent/runs", latest, "events.jsonl"), "utf8");

    assert.equal(metadata.status, "completed");
    assert.match(metadata.goal, /Chat conversation: 你好/);
    assert.equal((events.match(/"type":"owner_message"/g) ?? []).length, 2);
    assert.match(events, /"content":"你好"/);
    assert.match(events, /"content":"结束"/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli chat keeps an explicit Skill selection for the conversation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-chat-skill-"));
  const marker = "CHAT GUIDANCE BODY";
  try {
    await mkdir(join(workspace, ".agents/skills/chat-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/chat-helper/SKILL.md"),
      ["---", "name: chat-helper", "description: Helps with chat.", "---", "", marker].join("\n"),
      "utf8"
    );
    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "chat", "--skill", "chat-helper"],
      {
        cwd: workspace,
        encoding: "utf8",
        input: "你好\n",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1",
          A_AGENT_USER_SKILLS_ROOT: join(workspace, "empty-user-skills")
        }
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const runDir = join(workspace, ".personal-agent/runs", latest);
    const metadata = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
    const events = await readFile(join(runDir, "events.jsonl"), "utf8");

    assert.deepEqual(metadata.skillSelectors, ["chat-helper"]);
    assert.deepEqual(metadata.selectedSkillPaths, [".agents/skills/chat-helper/SKILL.md"]);
    assert.match(events, /"type":"skill_packs"/);
    assert.doesNotMatch(events, new RegExp(marker));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli chat completes and evaluates a Task Run when input ends", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-chat-active-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "chat"], {
      cwd: workspace,
      encoding: "utf8",
      input: "你好\n",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Bootstrap provider cannot answer with a real model/);
    assert.match(result.stdout, /Completed Chat Task Run/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );
    const events = await readFile(join(workspace, ".personal-agent/runs", latest, "events.jsonl"), "utf8");

    assert.equal(metadata.status, "completed");
    assert.equal((events.match(/"type":"owner_message"/g) ?? []).length, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run prints Learning Lens notes when --learn is enabled", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-learning-lens-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "--learn", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /\[learn\] planning - /);
    assert.match(result.stderr, /\[learn\] checkpoint - /);
    assert.match(result.stderr, /\[learn\] evaluation - /);
    assert.match(result.stdout, /Completed Task Run/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run records unavailable model review when --review uses bootstrap", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-model-review-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "--review", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Completed Task Run/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const evaluation = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "evaluation.json"), "utf8")
    );

    assert.equal(evaluation.verdict, "partial");
    assert.deepEqual(evaluation.modelReview, {
      verdict: "unavailable",
      reason: "Model-assisted review requires a real Model Provider."
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run can display the recovery path with an explicit debug switch", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-debug-recovery-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_DEBUG_RECOVERY: "1",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /\[agent\] turn 1 recovery - Agent Step plan\.steps must be a string array/);
    assert.match(result.stderr, /\[agent\] turn 1 plan - Create a minimal Task Plan/);
    assert.match(result.stdout, /Completed Task Run/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const events = await readFile(join(workspace, ".personal-agent/runs", latest, "events.jsonl"), "utf8");

    assert.match(events, /"type":"recovery"/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli run refuses an ambiguous task before creating a Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-clarification-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "处理一下"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[agent\] clarification required/);
    assert.match(result.stderr, /task boundary is ambiguous/);
    assert.doesNotMatch(result.stdout, /Completed Task Run/);
    await assert.rejects(readFile(join(workspace, ".personal-agent/runs/latest"), "utf8"));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start reads one interactive task and completes a bootstrap Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "start"], {
      cwd: workspace,
      encoding: "utf8",
      input: "summarize interactive docs\n",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Task> /);
    assert.match(result.stderr, /\[agent\] turn 1 plan - Create a minimal Task Plan/);
    assert.match(result.stdout, /Completed Task Run/);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );
    const report = await readFile(join(workspace, ".personal-agent/runs", latest, "report.md"), "utf8");

    assert.equal(metadata.goal, "summarize interactive docs");
    assert.equal(metadata.status, "completed");
    assert.match(report, /summarize interactive docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start applies one explicit Skill selection to every interactive task", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-skill-"));
  const guidanceMarker = "START FULL GUIDANCE MARKER";
  try {
    await mkdir(join(workspace, ".agents/skills/start-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/start-helper/SKILL.md"),
      [
        "---",
        "name: start-helper",
        "description: Helps every task in one start session.",
        "---",
        "",
        guidanceMarker
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "start", "--skill", "start-helper"],
      {
        cwd: workspace,
        encoding: "utf8",
        input: ["summarize first docs", "summarize second docs", "exit"].join("\n"),
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/Completed Task Run/g) ?? []).length, 2);
    const runsRoot = join(workspace, ".personal-agent/runs");
    const runIds = (await readdir(runsRoot)).filter((entry) => entry.startsWith("run-"));
    assert.equal(runIds.length, 2);
    for (const runId of runIds) {
      const runDir = join(runsRoot, runId);
      const metadata = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
      const events = await readFile(join(runDir, "events.jsonl"), "utf8");

      assert.deepEqual(metadata.skillSelectors, ["start-helper"]);
      assert.deepEqual(metadata.selectedSkillPaths, [".agents/skills/start-helper/SKILL.md"]);
      assert.match(events, /"guidance":\{"sha256":"[a-f0-9]{64}","bytes":\d+\}/);
      assert.doesNotMatch(events, new RegExp(guidanceMarker));
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start rejects an unknown explicit Skill before creating Task Run state", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-missing-skill-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "start", "--skill", "missing-helper"],
      {
        cwd: workspace,
        encoding: "utf8",
        input: "summarize interactive docs\n",
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          OPENAI_API_KEY: "",
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /a-agent: start failed: Skill Pack not found: missing-helper/);
    await assert.rejects(readFile(join(workspace, ".personal-agent/runs/latest"), "utf8"), /ENOENT/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start runs multiple interactive tasks until exit", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-repl-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "start"], {
      cwd: workspace,
      encoding: "utf8",
      input: ["summarize first docs", "summarize second docs", "exit"].join("\n"),
      env
    });
    const history = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "history"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(result.status, 0);
    assert.equal((result.stdout.match(/Completed Task Run/g) ?? []).length, 2);
    assert.equal(history.status, 0);
    assert.match(history.stdout, /summarize first docs/);
    assert.match(history.stdout, /summarize second docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start prompts again after an empty interactive line", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-empty-line-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "start"], {
      cwd: workspace,
      encoding: "utf8",
      input: "\nexit\n",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.equal((result.stderr.match(/Task> /g) ?? []).length, 2);
    assert.doesNotMatch(result.stdout, /Completed Task Run/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli start clarifies an ambiguous interactive task before running it", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-cli-start-clarification-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "start"], {
      cwd: workspace,
      encoding: "utf8",
      input: ["处理一下", "帮我总结当前目录", "exit"].join("\n"),
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /\[agent\] clarification required/);
    assert.match(result.stderr, /Clarification> /);
    assert.equal((result.stdout.match(/Completed Task Run/g) ?? []).length, 1);

    const latest = (await readFile(join(workspace, ".personal-agent/runs/latest"), "utf8")).trim();
    const metadata = JSON.parse(
      await readFile(join(workspace, ".personal-agent/runs", latest, "run.json"), "utf8")
    );

    assert.match(metadata.goal, /处理一下/);
    assert.match(metadata.goal, /Clarification: 帮我总结当前目录/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history prints an empty-state message", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-empty-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "history"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No Task Runs found/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history lists recent Task Runs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const run = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });
    const history = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "history"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(run.status, 0);
    assert.equal(history.status, 0);
    assert.match(history.stdout, /Recent Task Runs/);
    assert.match(history.stdout, /completed/);
    assert.match(history.stdout, /evaluation: partial/);
    assert.match(history.stdout, /report: .*\.personal-agent\/runs\/.*\/report\.md/);
    assert.match(history.stdout, /summarize docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history filters Task Runs by status", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-status-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    await createTaskRun(workspace, {
      goal: "keep active draft",
      mode: "advisory",
      successCheck: "active task remains resumable"
    });
    const completed = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });
    const completedHistory = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "history", "--status", "completed"],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const activeHistory = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "history", "--status", "active"],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );

    assert.equal(completed.status, 0);
    assert.equal(completedHistory.status, 0);
    assert.match(completedHistory.stdout, /summarize docs/);
    assert.doesNotMatch(completedHistory.stdout, /keep active draft/);
    assert.equal(activeHistory.status, 0);
    assert.match(activeHistory.stdout, /keep active draft/);
    assert.doesNotMatch(activeHistory.stdout, /summarize docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history shows the latest checkpoint id when present", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-checkpoint-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "resume-ready draft",
      mode: "advisory",
      successCheck: "draft can resume from checkpoint"
    });
    const checkpoint = await writeCheckpoint(run.runDir, {
      goal: "resume-ready draft",
      turn: 1,
      eventCount: 0
    });
    const storedCheckpoint = await readCheckpoint(run.runDir, checkpoint.id);

    const history = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "history", "--status", "active"],
      {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          PERSONAL_AGENT_SKIP_DOTENV: "1"
        }
      }
    );

    assert.equal(history.status, 0);
    assert.match(history.stdout, /resume-ready draft/);
    assert.match(history.stdout, new RegExp(`checkpoint: ${checkpoint.id} \\(turn 1, created `));
    assert.ok(history.stdout.includes(`created ${storedCheckpoint.createdAt}`));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history limits Task Runs after status filtering", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-limit-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const olderCompleted = await createTaskRun(workspace, {
      goal: "older completed task",
      mode: "advisory",
      successCheck: "older task completed"
    });
    await updateTaskRunStatus(olderCompleted.runDir, "completed");
    await waitForDistinctTimestamp();
    await createTaskRun(workspace, {
      goal: "active draft task",
      mode: "advisory",
      successCheck: "active task remains resumable"
    });
    await waitForDistinctTimestamp();
    const newerCompleted = await createTaskRun(workspace, {
      goal: "newer completed task",
      mode: "advisory",
      successCheck: "newer task completed"
    });
    await writeTaskReport(newerCompleted.runDir, "Newer completed report.");
    await updateTaskRunStatus(newerCompleted.runDir, "completed");

    const history = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "history", "--status", "completed", "--limit", "1"],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );

    assert.equal(history.status, 0);
    assert.match(history.stdout, /newer completed task/);
    assert.match(history.stdout, /report: .*\.personal-agent\/runs\/.*\/report\.md/);
    assert.doesNotMatch(history.stdout, /older completed task/);
    assert.doesNotMatch(history.stdout, /active draft task/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli history offsets Task Runs after status filtering", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-offset-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const oldestCompleted = await createTaskRun(workspace, {
      goal: "oldest completed page task",
      mode: "advisory",
      successCheck: "oldest task completed"
    });
    await updateTaskRunStatus(oldestCompleted.runDir, "completed");
    await waitForDistinctTimestamp();
    await createTaskRun(workspace, {
      goal: "active page task",
      mode: "advisory",
      successCheck: "active task remains resumable"
    });
    await waitForDistinctTimestamp();
    const middleCompleted = await createTaskRun(workspace, {
      goal: "middle completed page task",
      mode: "advisory",
      successCheck: "middle task completed"
    });
    await updateTaskRunStatus(middleCompleted.runDir, "completed");
    await waitForDistinctTimestamp();
    const newestCompleted = await createTaskRun(workspace, {
      goal: "newest completed page task",
      mode: "advisory",
      successCheck: "newest task completed"
    });
    await updateTaskRunStatus(newestCompleted.runDir, "completed");

    const history = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "history", "--status", "completed", "--limit", "1", "--offset", "1"],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );

    assert.equal(history.status, 0);
    assert.match(history.stdout, /Showing 2-2 of 3 Task Runs \(offset 1, limit 1\)/);
    assert.match(history.stdout, /Previous page: a-agent history --status completed --limit 1 --offset 0/);
    assert.match(history.stdout, /Next page: a-agent history --status completed --limit 1 --offset 2/);
    assert.match(history.stdout, /middle completed page task/);
    assert.doesNotMatch(history.stdout, /newest completed page task/);
    assert.doesNotMatch(history.stdout, /oldest completed page task/);
    assert.doesNotMatch(history.stdout, /active page task/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli resume prints an empty-state message", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-empty-"));
  try {
    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "resume"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No Task Run to resume/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli resume continues the latest active Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "resume docs",
      mode: "advisory",
      successCheck: "resume produces report"
    });
    await appendRunEvent(run.runDir, {
      type: "plan",
      summary: "Created before resume",
      steps: ["resume"]
    });
    await writeCheckpoint(run.runDir, {
      goal: "resume docs",
      mode: "advisory",
      turn: 1,
      eventCount: 1
    });

    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "resume"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1"
      }
    });

    const metadata = JSON.parse(await readFile(join(run.runDir, "run.json"), "utf8"));
    const report = await readFile(join(run.runDir, "report.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(`Resumed Task Run ${run.id}`));
    assert.equal(metadata.status, "completed");
    assert.match(report, /resume docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli resume reports changed Skill guidance without an unhandled stack", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-skill-drift-cli-"));
  try {
    const skillPath = ".agents/skills/docs-helper/SKILL.md";
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, skillPath),
      ["---", "name: docs-helper", "description: Helps with docs.", "---", "", "CURRENT BODY"].join("\n"),
      "utf8"
    );
    const run = await createTaskRun(workspace, {
      goal: "resume docs",
      mode: "advisory",
      successCheck: "resume produces report",
      skillSelectors: ["docs-helper"],
      selectedSkillPaths: [skillPath]
    });
    await appendRunEvent(run.runDir, {
      type: "skill_packs",
      skillPacks: [
        {
          name: "docs-helper",
          description: "Helps with docs.",
          path: skillPath,
          source: {
            kind: "workspace",
            label: "workspace",
            root: join(workspace, ".agents/skills"),
            priority: 1
          },
          selection: {
            mode: "explicit",
            selector: "docs-helper",
            precedenceOverridden: false
          },
          guidance: {
            sha256: "0".repeat(64),
            bytes: 1
          }
        }
      ]
    });

    const result = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "resume"], {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "",
        OPENAI_API_KEY: "",
        PERSONAL_AGENT_SKIP_DOTENV: "1",
        A_AGENT_USER_SKILLS_ROOT: join(workspace, "empty-user-skills")
      }
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /a-agent: resume failed: Skill Pack guidance changed since Task Run started/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory prints and appends Project Memory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-"));
  try {
    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const viewBefore = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });
    const append = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "append", "Prefer concise CLI output."],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(viewBefore.status, 0);
    assert.match(viewBefore.stdout, /# Project Memory/);
    assert.equal(append.status, 0);
    assert.match(append.stdout, /Appended Project Memory note/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /- Prefer concise CLI output\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory appends a note to a named section", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-section-"));
  try {
    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const append = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "append", "--section", "preferences", "Prefer concise CLI output."],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    const preferences = viewAfter.stdout.indexOf("## Preferences");
    const conventions = viewAfter.stdout.indexOf("## Project Conventions");
    const note = viewAfter.stdout.indexOf("- Prefer concise CLI output.");

    assert.equal(append.status, 0);
    assert.match(append.stdout, /Appended Project Memory note/);
    assert.equal(viewAfter.status, 0);
    assert.ok(note > preferences);
    assert.ok(note < conventions);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory applies suggestions to Project Memory with explicit approval", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "apply memory suggestions",
      mode: "advisory",
      successCheck: "memory receives suggestions"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner prefers concise CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    const preferences = viewAfter.stdout.indexOf("## Preferences");
    const conventions = viewAfter.stdout.indexOf("## Project Conventions");
    const note = viewAfter.stdout.indexOf("- Owner prefers concise CLI output.");

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Applied 1 Memory Suggestion/);
    assert.equal(viewAfter.status, 0);
    assert.ok(note > preferences);
    assert.ok(note < conventions);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips suggestions that already exist in Project Memory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-duplicate-"));
  try {
    await appendProjectMemory(workspace, "Owner prefers concise CLI output.", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply duplicate memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive duplicates"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner prefers concise CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    const occurrences = viewAfter.stdout.match(/Owner prefers concise CLI output\./g) ?? [];

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped duplicate Memory Suggestion/);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.equal(occurrences.length, 1);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips near-duplicate Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-near-duplicate-"));
  try {
    await appendProjectMemory(workspace, "Owner prefers concise CLI output.", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply near duplicate memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive paraphrased duplicates"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner likes brief command line output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped duplicate Memory Suggestion/);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Owner prefers concise CLI output\./);
    assert.doesNotMatch(viewAfter.stdout, /Owner likes brief command line output\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips conflicting Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-conflict-"));
  try {
    await appendProjectMemory(workspace, "Owner prefers concise CLI output.", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply conflicting memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive conflicting preferences"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner prefers verbose CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /Owner prefers concise CLI output\./);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Owner prefers concise CLI output\./);
    assert.doesNotMatch(viewAfter.stdout, /Owner prefers verbose CLI output\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips autonomy preference conflicts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-autonomy-conflict-"));
  try {
    await appendProjectMemory(workspace, "Owner prefers the agent to implement changes directly.", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply autonomy preference conflicts",
      mode: "advisory",
      successCheck: "memory does not receive opposite autonomy preferences"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner prefers the agent to only propose changes.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /Owner prefers the agent to implement changes directly\./);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Owner prefers the agent to implement changes directly\./);
    assert.doesNotMatch(viewAfter.stdout, /Owner prefers the agent to only propose changes\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips Chinese autonomy preference conflicts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-zh-autonomy-conflict-"));
  try {
    await appendProjectMemory(workspace, "用户偏好 agent 直接修改代码。", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply Chinese autonomy preference conflicts",
      mode: "advisory",
      successCheck: "memory does not receive opposite Chinese autonomy preferences"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "用户偏好 agent 先确认再执行。",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /用户偏好 agent 直接修改代码。/);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /用户偏好 agent 直接修改代码。/);
    assert.doesNotMatch(viewAfter.stdout, /用户偏好 agent 先确认再执行。/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips negated conflicting Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-negated-conflict-"));
  try {
    await appendProjectMemory(workspace, "Project uses LangChain.", "stable-facts");
    const run = await createTaskRun(workspace, {
      goal: "apply negated conflicting memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive negated stable fact conflicts"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "stable-facts",
        note: "Project does not use LangChain.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /Project uses LangChain\./);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Project uses LangChain\./);
    assert.doesNotMatch(viewAfter.stdout, /Project does not use LangChain\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips forbidden conflicting Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-forbidden-conflict-"));
  try {
    await appendProjectMemory(workspace, "Generated code requires comments.", "project-conventions");
    const run = await createTaskRun(workspace, {
      goal: "apply forbidden conflicting memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive forbidden project convention conflicts"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "project-conventions",
        note: "Generated code forbids comments.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /Generated code requires comments\./);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Generated code requires comments\./);
    assert.doesNotMatch(viewAfter.stdout, /Generated code forbids comments\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips avoid-word project convention conflicts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-avoid-convention-conflict-"));
  try {
    await appendProjectMemory(workspace, "Generated code must include necessary comments.", "project-conventions");
    const run = await createTaskRun(workspace, {
      goal: "apply avoid-word project convention conflicts",
      mode: "advisory",
      successCheck: "memory does not receive opposite comment conventions"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "project-conventions",
        note: "Generated code should avoid comments.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /Generated code must include necessary comments\./);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /Generated code must include necessary comments\./);
    assert.doesNotMatch(viewAfter.stdout, /Generated code should avoid comments\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips Chinese preference conflicts", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-zh-conflict-"));
  try {
    await appendProjectMemory(workspace, "用户偏好精简输出。", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "apply Chinese conflicting memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive Chinese preference conflicts"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "用户偏好详细输出。",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    assert.equal(apply.status, 0);
    assert.match(apply.stdout, /Skipped conflicting Memory Suggestion/);
    assert.match(apply.stdout, /用户偏好精简输出。/);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.match(viewAfter.stdout, /用户偏好精简输出。/);
    assert.doesNotMatch(viewAfter.stdout, /用户偏好详细输出。/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli memory skips low-quality Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-apply-quality-"));
  try {
    // Assemble the credential-shaped note at runtime to keep fake secrets out of source scanning results.
    const secretShapedNote = `DEEPSEEK_API_KEY=${["test", "secret", "token"].join("-")}`;
    const run = await createTaskRun(workspace, {
      goal: "apply low quality memory suggestions",
      mode: "advisory",
      successCheck: "memory does not receive low quality suggestions"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "ok",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      },
      {
        section: "stable-facts",
        note: "Today the Owner is debugging this task.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      },
      {
        section: "stable-facts",
        note: secretShapedNote,
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      },
      {
        section: "stable-facts",
        note: "The project is important.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      },
      {
        section: "preferences",
        note: "Owner wants good results.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const env = {
      ...process.env,
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const apply = spawnSync(
      process.execPath,
      [join(root, "src/cli/index.ts"), "memory", "apply-suggestions", "--yes", run.id],
      {
        cwd: workspace,
        encoding: "utf8",
        env
      }
    );
    const viewAfter = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "memory"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    const skipped = apply.stdout.match(/Skipped low-quality Memory Suggestion/g) ?? [];

    assert.equal(apply.status, 0);
    assert.equal(skipped.length, 5);
    assert.match(apply.stdout, /Applied 0 Memory Suggestions/);
    assert.equal(viewAfter.status, 0);
    assert.doesNotMatch(viewAfter.stdout, /- ok/);
    assert.doesNotMatch(viewAfter.stdout, /Today the Owner is debugging this task/);
    assert.doesNotMatch(viewAfter.stdout, /test-secret-token/);
    assert.doesNotMatch(viewAfter.stdout, /The project is important/);
    assert.doesNotMatch(viewAfter.stdout, /Owner wants good results/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("cli export writes a Markdown export for the latest Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-"));
  try {
    const env = {
      ...process.env,
      DEEPSEEK_API_KEY: "",
      OPENAI_API_KEY: "",
      PERSONAL_AGENT_SKIP_DOTENV: "1"
    };
    const run = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "run", "summarize docs"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });
    const exported = spawnSync(process.execPath, [join(root, "src/cli/index.ts"), "export"], {
      cwd: workspace,
      encoding: "utf8",
      env
    });

    const exportPath = exported.stdout.match(/Exported Task Run .* to (.*)/)?.[1]?.trim();
    assert.equal(run.status, 0);
    assert.equal(exported.status, 0);
    assert.ok(exportPath);

    const markdown = await readFile(exportPath, "utf8");
    assert.match(markdown, /# Task Run Export/);
    assert.match(markdown, /summarize docs/);
    assert.match(markdown, /## Report/);
    assert.match(markdown, /## Events/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
