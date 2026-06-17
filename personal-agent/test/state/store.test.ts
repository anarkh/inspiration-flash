import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  appendRunEvent,
  createTaskRun,
  ensureWorkspaceState,
  exportTaskRun,
  listTaskRuns,
  appendProjectMemory,
  readLatestCheckpoint,
  readLatestTaskRun,
  readCheckpoint,
  readLatestRunId,
  readMemorySuggestions,
  readProjectMemory,
  readRunEvents,
  updateTaskRunStatus,
  writeCheckpoint,
  writeTaskEvaluation,
  writeMemorySuggestions,
  writeTaskReport
} from "../../src/state/store.ts";

test("ensureWorkspaceState creates config and memory files", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-state-"));
  try {
    const state = await ensureWorkspaceState(workspace);

    const config = JSON.parse(await readFile(join(state.stateDir, "config.json"), "utf8"));
    const memory = await readFile(join(state.stateDir, "memory.md"), "utf8");

    assert.equal(config.modelProvider, "deepseek");
    assert.equal(config.model, "deepseek-v4-flash");
    assert.match(memory, /# Project Memory/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Project Memory can be read and appended", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-"));
  try {
    assert.match(await readProjectMemory(workspace), /# Project Memory/);

    await appendProjectMemory(workspace, "Remember concise CLI output.");

    const memory = await readProjectMemory(workspace);
    assert.match(memory, /## Open Threads/);
    assert.match(memory, /- Remember concise CLI output\./);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Project Memory notes can be appended to a named section", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-section-"));
  try {
    await appendProjectMemory(workspace, "Prefer concise CLI output.", "preferences");

    const memory = await readProjectMemory(workspace);
    const preferences = memory.indexOf("## Preferences");
    const conventions = memory.indexOf("## Project Conventions");
    const note = memory.indexOf("- Prefer concise CLI output.");

    assert.ok(note > preferences);
    assert.ok(note < conventions);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("createTaskRun records metadata and latest pointer", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-run-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "summary covers docs"
    });

    const latest = await readLatestRunId(workspace);
    const metadata = JSON.parse(await readFile(join(run.runDir, "run.json"), "utf8"));

    assert.equal(latest, run.id);
    assert.equal(metadata.goal, "summarize docs");
    assert.equal(metadata.status, "active");
    assert.equal(metadata.mode, "advisory");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Task Run events and checkpoints are durable", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-checkpoint-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "write summary",
      mode: "execution",
      successCheck: "summary exists"
    });

    await appendRunEvent(run.runDir, { type: "message", content: "starting" });
    const checkpoint = await writeCheckpoint(run.runDir, {
      plan: ["read docs"],
      lastEvent: "starting"
    });

    const events = await readFile(join(run.runDir, "events.jsonl"), "utf8");
    const restored = await readCheckpoint(run.runDir, checkpoint.id);

    assert.match(events, /"type":"message"/);
    assert.deepEqual(restored.state, { plan: ["read docs"], lastEvent: "starting" });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("listTaskRuns returns recent run metadata", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-history-"));
  try {
    const first = await createTaskRun(workspace, {
      goal: "first task",
      mode: "advisory",
      successCheck: "first check"
    });
    const second = await createTaskRun(workspace, {
      goal: "second task",
      mode: "execution",
      successCheck: "second check"
    });
    await updateTaskRunStatus(first.runDir, "completed");

    const runs = await listTaskRuns(workspace, 10);

    assert.equal(runs.length, 2);
    assert.deepEqual(
      runs.map((run) => run.id).sort(),
      [first.id, second.id].sort()
    );
    assert.equal(runs.find((run) => run.id === first.id)?.status, "completed");
    assert.equal(runs.find((run) => run.id === first.id)?.goal, "first task");
    assert.equal(runs.find((run) => run.id === second.id)?.mode, "execution");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("latest Task Run helpers restore metadata, events, and checkpoint", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-state-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "resume me",
      mode: "advisory",
      successCheck: "resumed"
    });
    await appendRunEvent(run.runDir, { type: "plan", summary: "Pause here", steps: ["resume later"] });
    const checkpoint = await writeCheckpoint(run.runDir, {
      goal: "resume me",
      mode: "advisory",
      turn: 1,
      eventCount: 1
    });

    const latestRun = await readLatestTaskRun(workspace);
    const events = await readRunEvents(run.runDir);
    const latestCheckpoint = await readLatestCheckpoint(run.runDir);

    assert.equal(latestRun?.id, run.id);
    assert.equal(latestRun?.runDir, run.runDir);
    assert.deepEqual(events, [{ type: "plan", summary: "Pause here", steps: ["resume later"] }]);
    assert.equal(latestCheckpoint?.id, checkpoint.id);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("exportTaskRun writes a readable Markdown export for a Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "export me",
      mode: "advisory",
      successCheck: "export includes report"
    });
    await appendRunEvent(run.runDir, { type: "message", content: "working" });
    await writeTaskReport(run.runDir, "Exported report.");
    await writeTaskEvaluation(run.runDir, { verdict: "pass" });
    await updateTaskRunStatus(run.runDir, "completed");

    const result = await exportTaskRun(workspace, run.id);
    assert.ok(result);
    const markdown = await readFile(result.path, "utf8");

    assert.equal(result.id, run.id);
    assert.match(markdown, /# Task Run Export/);
    assert.match(markdown, /export me/);
    assert.match(markdown, /Exported report/);
    assert.match(markdown, /"verdict": "pass"/);
    assert.match(markdown, /"type": "message"/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("exportTaskRun includes a decision trace, tool summary, and changed resources", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-summary-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "export tool summary",
      mode: "advisory",
      successCheck: "export includes trace summaries"
    });
    await appendRunEvent(run.runDir, { type: "plan", summary: "Create a draft", steps: ["Write draft"] });
    await appendRunEvent(run.runDir, {
      type: "tool",
      tool: "write_file",
      input: { path: "draft.md", content: "hello\n" }
    });
    await appendRunEvent(run.runDir, {
      type: "tool_result",
      tool: "write_file",
      output: { type: "file_written", path: "draft.md", bytes: 6 }
    });
    await appendRunEvent(run.runDir, { type: "finish", report: "Draft written." });
    await writeTaskReport(run.runDir, "Draft written.");
    await writeTaskEvaluation(run.runDir, { verdict: "pass" });

    const result = await exportTaskRun(workspace, run.id);
    assert.ok(result);
    const markdown = await readFile(result.path, "utf8");

    assert.match(markdown, /## Decision Trace/);
    assert.match(markdown, /- plan: Create a draft/);
    assert.match(markdown, /- tool: write_file/);
    assert.match(markdown, /- tool_result: write_file -> file_written/);
    assert.match(markdown, /## Local Tools Used/);
    assert.match(markdown, /- write_file/);
    assert.match(markdown, /## Changed Resources/);
    assert.match(markdown, /- draft\.md/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("exportTaskRun redacts common secret values from exported Markdown", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-redaction-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "export redacted run",
      mode: "advisory",
      successCheck: "export redacts secrets"
    });
    await appendRunEvent(run.runDir, {
      type: "tool_result",
      tool: "run_command",
      output: {
        type: "command_result",
        command: "printenv",
        exitCode: 0,
        stdout: "DEEPSEEK_API_KEY=test-deepseek-secret\nAuthorization: Bearer test-bearer-token-123456\n",
        stderr: ""
      }
    });
    await writeTaskReport(run.runDir, "Provider key sk-testsecret1234567890 was observed.");
    await writeTaskEvaluation(run.runDir, { detail: "OPENAI_API_KEY=test-openai-secret" });

    const result = await exportTaskRun(workspace, run.id);
    assert.ok(result);
    const markdown = await readFile(result.path, "utf8");

    assert.doesNotMatch(markdown, /test-deepseek-secret/);
    assert.doesNotMatch(markdown, /test-bearer-token-123456/);
    assert.doesNotMatch(markdown, /sk-testsecret1234567890/);
    assert.doesNotMatch(markdown, /test-openai-secret/);
    assert.match(markdown, /\[REDACTED_SECRET\]/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("exportTaskRun redacts broader secret shapes from exported Markdown", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-broader-redaction-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "export broadly redacted run",
      mode: "advisory",
      successCheck: "export redacts broader secret shapes"
    });
    await appendRunEvent(run.runDir, {
      type: "tool_result",
      tool: "run_command",
      output: {
        type: "command_result",
        command: "inspect secrets",
        exitCode: 0,
        stdout: [
          "GITHUB_TOKEN=ghp_exporttestsecret1234567890",
          "DATABASE_PASSWORD='database-password-secret'",
          "callback=https://example.test/cb?access_token=url-access-secret-123456&client_secret=url-client-secret-654321"
        ].join("\n"),
        stderr: ""
      }
    });
    await writeTaskReport(
      run.runDir,
      'JSON payload: {"api_key":"json-api-secret-123456","password":"json-password-secret-654321"}'
    );
    await writeTaskEvaluation(run.runDir, { detail: "refresh_token=refresh-token-secret-123456" });

    const result = await exportTaskRun(workspace, run.id);
    assert.ok(result);
    const markdown = await readFile(result.path, "utf8");

    assert.doesNotMatch(markdown, /ghp_exporttestsecret1234567890/);
    assert.doesNotMatch(markdown, /database-password-secret/);
    assert.doesNotMatch(markdown, /url-access-secret-123456/);
    assert.doesNotMatch(markdown, /url-client-secret-654321/);
    assert.doesNotMatch(markdown, /json-api-secret-123456/);
    assert.doesNotMatch(markdown, /json-password-secret-654321/);
    assert.doesNotMatch(markdown, /refresh-token-secret-123456/);
    assert.match(markdown, /\[REDACTED_SECRET\]/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("exportTaskRun includes Memory Suggestions when present", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-export-memory-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "export memory suggestions",
      mode: "advisory",
      successCheck: "export includes memory suggestions"
    });
    await writeTaskReport(run.runDir, "Report with memory suggestion.");
    await writeTaskEvaluation(run.runDir, { verdict: "pass" });
    await writeFile(
      join(run.runDir, "memory-suggestions.json"),
      `${JSON.stringify(
        [
          {
            section: "preferences",
            note: "Owner prefers concise CLI output.",
            reason: "Model reflection during the Task Run",
            source: "model_reflect"
          }
        ],
        null,
        2
      )}\n`
    );

    const result = await exportTaskRun(workspace, run.id);
    assert.ok(result);
    const markdown = await readFile(result.path, "utf8");

    assert.match(markdown, /## Memory Suggestions/);
    assert.match(markdown, /preferences/);
    assert.match(markdown, /Owner prefers concise CLI output/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("readMemorySuggestions restores candidate notes for a Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-read-memory-suggestions-"));
  try {
    const run = await createTaskRun(workspace, {
      goal: "read memory suggestions",
      mode: "advisory",
      successCheck: "suggestions are readable"
    });
    await writeMemorySuggestions(run.runDir, [
      {
        section: "preferences",
        note: "Owner prefers concise CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);

    const result = await readMemorySuggestions(workspace, run.id);

    assert.equal(result?.id, run.id);
    assert.deepEqual(result?.suggestions, [
      {
        section: "preferences",
        note: "Owner prefers concise CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
