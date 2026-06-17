import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resumeLatestTask, runTask } from "../../src/agent/runner.ts";
import type { ModelProvider } from "../../src/model/provider.ts";
import { appendProjectMemory, appendRunEvent, createTaskRun, writeCheckpoint } from "../../src/state/store.ts";

test("runTask executes provider steps and writes report and evaluation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Summarize the request", steps: ["Acknowledge task"] };
      }
      if (input.turn === 2) {
        return { type: "message", content: "I will handle this as an advisory task." };
      }
      return { type: "finish", report: "Task accepted and planned." };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "Task produces a report",
      provider
    });

    const report = await readFile(join(result.runDir, "report.md"), "utf8");
    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));
    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");
    const metadata = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));

    assert.equal(result.status, "completed");
    assert.match(report, /Task accepted and planned/);
    assert.equal(evaluation.verdict, "pass");
    assert.equal(evaluation.successCheck, "pass");
    assert.match(events, /"type":"plan"/);
    assert.match(events, /"type":"finish"/);
    assert.equal(metadata.status, "completed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask emits a console-friendly log for each model step", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-log-"));
  const logs: string[] = [];
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Inspect the workspace", steps: ["List files"] };
      }
      if (input.turn === 2) {
        return { type: "message", content: "I found the workspace files." };
      }
      return { type: "finish", report: "Workspace summarized.\nMore details are in the report." };
    }
  };

  try {
    await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "Task produces a report",
      provider,
      logStep(message) {
        logs.push(message);
      }
    });

    assert.deepEqual(logs, [
      "[agent] turn 1 plan - Inspect the workspace | steps: List files",
      "[agent] turn 2 message - I found the workspace files.",
      "[agent] turn 3 finish - Workspace summarized. More details are in the report."
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask passes Project Memory to the Model Provider", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-memory-"));
  let sawMemory = false;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      sawMemory = (input as typeof input & { projectMemory?: string }).projectMemory?.includes(
        "Owner prefers concise CLI output."
      ) ?? false;
      return { type: "finish", report: "Finished with Project Memory." };
    }
  };

  try {
    await appendProjectMemory(workspace, "Owner prefers concise CLI output.", "preferences");

    await runTask({
      workspace,
      goal: "use memory",
      mode: "advisory",
      successCheck: "provider sees memory",
      provider
    });

    assert.equal(sawMemory, true);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask filters Project Memory to notes relevant to the current task", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-relevant-memory-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.match(input.projectMemory ?? "", /Docs live in README/);
      assert.doesNotMatch(input.projectMemory ?? "", /Billing renews annually/);
      return { type: "finish", report: "Finished with relevant Project Memory." };
    }
  };

  try {
    await appendProjectMemory(workspace, "Docs live in README.", "project-conventions");
    await appendProjectMemory(workspace, "Billing renews annually.", "stable-facts");

    await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references README docs",
      provider
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask executes Local Tool steps and returns observations to the provider", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tool-runner-"));
  let observedToolOutput = "";
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }

      const result = input.events.find(
        (event) => typeof event === "object" && event !== null && "type" in event && event.type === "tool_result"
      );
      if (result && typeof result === "object" && "output" in result && typeof result.output === "string") {
        observedToolOutput = result.output;
      }
      return { type: "finish", report: `Read notes: ${observedToolOutput.trim()}` };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");

    const result = await runTask({
      workspace,
      goal: "read notes",
      mode: "advisory",
      successCheck: "Task reads notes",
      provider
    });

    const report = await readFile(join(result.runDir, "report.md"), "utf8");
    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");

    assert.equal(observedToolOutput, "alpha\n");
    assert.match(report, /Read notes: alpha/);
    assert.match(events, /"type":"tool_result"/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask writes model reflection notes as Memory Suggestions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-memory-suggestions-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "plan", summary: "Plan memory update", steps: ["Reflect before finish"] };
      }
      if (input.turn === 2) {
        return {
          type: "reflect",
          section: "preferences",
          note: "Owner prefers concise CLI output."
        };
      }
      return { type: "finish", report: "Task completed with a memory suggestion." };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "remember output style",
      mode: "advisory",
      successCheck: "Task proposes memory",
      provider
    });

    const suggestions = JSON.parse(await readFile(join(result.runDir, "memory-suggestions.json"), "utf8"));

    assert.deepEqual(suggestions, [
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

test("runTask applies confirmed write_file actions", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-confirm-runner-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "write_file", input: { path: "draft.md", content: "hello\n" } };
      }

      const result = input.events.find(
        (event) => typeof event === "object" && event !== null && "type" in event && event.type === "tool_result"
      );
      return { type: "finish", report: `Observed: ${JSON.stringify(result)}` };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "write draft",
      mode: "advisory",
      successCheck: "Task writes a draft",
      provider,
      async confirmAction(request) {
        assert.equal(request.tool, "write_file");
        return true;
      }
    });

    const report = await readFile(join(result.runDir, "report.md"), "utf8");

    assert.equal(await readFile(join(workspace, "draft.md"), "utf8"), "hello\n");
    assert.match(report, /file_written/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask records denied confirmations without applying them", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-deny-runner-"));
  let observedOutput = "";
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "write_file", input: { path: "draft.md", content: "hello\n" } };
      }

      const result = input.events.find(
        (event) => typeof event === "object" && event !== null && "type" in event && event.type === "tool_result"
      );
      if (result && typeof result === "object" && "output" in result) {
        observedOutput = JSON.stringify(result.output);
      }
      return { type: "finish", report: `Observed: ${observedOutput}` };
    }
  };

  try {
    await runTask({
      workspace,
      goal: "write draft",
      mode: "advisory",
      successCheck: "Task writes a draft",
      provider,
      async confirmAction() {
        return false;
      }
    });

    assert.match(observedOutput, /confirmation_denied/);
    await assert.rejects(readFile(join(workspace, "draft.md"), "utf8"), /ENOENT/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("resumeLatestTask continues the latest active run from checkpoint events", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-runner-"));
  let sawPriorPlan = false;
  let sawMemory = false;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.equal(input.turn, 2);
      sawPriorPlan = input.events.some((event) => event.type === "plan");
      sawMemory = (input as typeof input & { projectMemory?: string }).projectMemory?.includes(
        "Owner prefers concise CLI output."
      ) ?? false;
      return { type: "finish", report: "Resumed from checkpoint." };
    }
  };

  try {
    await appendProjectMemory(workspace, "Owner prefers concise CLI output.", "preferences");
    const run = await createTaskRun(workspace, {
      goal: "resume task",
      mode: "advisory",
      successCheck: "resume finishes"
    });
    await appendRunEvent(run.runDir, {
      type: "plan",
      summary: "Initial plan",
      steps: ["stop here"]
    });
    await writeCheckpoint(run.runDir, {
      goal: "resume task",
      mode: "advisory",
      turn: 1,
      eventCount: 1
    });

    const result = await resumeLatestTask({
      workspace,
      provider
    });

    assert.equal(result.status, "completed");
    assert.equal(result.id, run.id);
    assert.equal(sawPriorPlan, true);
    assert.equal(sawMemory, true);
    assert.match(await readFile(join(run.runDir, "report.md"), "utf8"), /Resumed from checkpoint/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("resumeLatestTask reports when no run exists", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-empty-"));
  try {
    const result = await resumeLatestTask({
      workspace,
      provider: {
        name: "fake",
        async nextStep() {
          throw new Error("provider should not be called");
        }
      }
    });

    assert.deepEqual(result, { status: "not_found" });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
