import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  appendProjectMemory,
  appendRunEvent,
  createTaskRun,
  writeCheckpoint,
  writeMemorySuggestions
} from "../../src/state/store.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("cli prints help", () => {
  const result = spawnSync(process.execPath, ["./src/cli/index.ts", "--help"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /personal-agent/);
  assert.match(result.stdout, /run <task>/);
  assert.match(result.stdout, /memory append \[--section <section>\] <note>/);
  assert.match(result.stdout, /memory apply-suggestions \[--yes\] \[run-id\]/);
  assert.match(result.stdout, /export \[run-id\]/);
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
    assert.equal(evaluation.verdict, "pass");
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
    assert.match(history.stdout, /summarize docs/);
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
        note: "DEEPSEEK_API_KEY=test-secret-token",
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
