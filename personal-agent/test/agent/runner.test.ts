import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resumeLatestTask, runChatTask, runTask } from "../../src/agent/runner.ts";
import type { ModelProvider } from "../../src/model/provider.ts";
import { appendProjectMemory, appendRunEvent, createTaskRun, exportTaskRun, writeCheckpoint } from "../../src/state/store.ts";
import type { ConfirmationRequired } from "../../src/tools/local-tools.ts";

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
      successChecks: [{ id: "report", type: "report_contains", value: "Task accepted" }],
      provider
    });

    const report = await readFile(join(result.runDir, "report.md"), "utf8");
    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));
    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");
    const metadata = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));

    assert.equal(result.status, "completed");
    assert.match(report, /Task accepted and planned/);
    assert.equal(evaluation.verdict, "pass");
    assert.equal(evaluation.schemaVersion, 2);
    assert.equal(evaluation.executionIntegrity.verdict, "pass");
    assert.equal(evaluation.taskCorrectness.verdict, "pass");
    assert.equal(evaluation.successCheck, "pass");
    assert.equal(evaluation.gateSafety, "pass");
    assert.equal(evaluation.traceQuality, "pass");
    assert.equal(evaluation.reportQuality, "pass");
    assert.deepEqual(evaluation.learningSignals, []);
    assert.deepEqual(evaluation.followUps, []);
    assert.match(events, /"type":"plan"/);
    assert.match(events, /"type":"finish"/);
    assert.equal(metadata.status, "completed");
    assert.deepEqual(metadata.successChecks, [
      { id: "report", type: "report_contains", value: "Task accepted" }
    ]);
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

test("runTask can attach an optional model-assisted review without overriding deterministic verdict", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-model-review-"));
  let callCount = 0;
  const provider: ModelProvider = {
    name: "fake-review",
    async nextStep(input) {
      callCount += 1;
      if (callCount === 1) {
        return { type: "plan", summary: "Plan the task", steps: ["Finish with a report"] };
      }
      if (callCount === 2) {
        return { type: "finish", report: "Task completed with deterministic evidence." };
      }

      assert.match(input.goal, /Review completed Task Run/);
      assert.match(input.successCheck, /Return model review JSON/);
      assert.match(JSON.stringify(input.events), /Task completed with deterministic evidence/);
      return {
        type: "finish",
        report: JSON.stringify({
          verdict: "fail",
          reason: "The report is too brief for a semantic reviewer."
        })
      };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "Task produces a report",
      successChecks: [{ id: "report", type: "report_contains", value: "deterministic evidence" }],
      provider,
      modelReview: true
    });

    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));

    assert.equal(callCount, 3);
    assert.equal(evaluation.verdict, "pass");
    assert.deepEqual(evaluation.modelReview, {
      verdict: "fail",
      reason: "The report is too brief for a semantic reviewer."
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask records a recovery attempt and retries when the provider returns an invalid step", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-recovery-"));
  let callCount = 0;
  let sawRecoveryEvent = false;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      callCount += 1;
      if (callCount === 1) {
        return { type: "plan", summary: "Missing required plan steps." };
      }
      if (callCount === 2) {
        assert.equal(input.turn, 1);
        sawRecoveryEvent = input.events.some(
          (event) => event.type === "recovery" && event.reason.includes("plan.steps")
        );
        return { type: "plan", summary: "Recovered plan", steps: ["Continue after schema repair"] };
      }
      return { type: "finish", report: "Recovered and finished." };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "recover from invalid step",
      mode: "advisory",
      successCheck: "Task recovers from invalid provider output",
      provider
    });

    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");

    assert.equal(result.status, "completed");
    assert.equal(callCount, 3);
    assert.equal(sawRecoveryEvent, true);
    assert.match(events, /"type":"recovery"/);
    assert.match(events, /plan\.steps/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask stops after bounded recovery attempts when invalid steps keep repeating", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-recovery-limit-"));
  let callCount = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      callCount += 1;
      return { type: "plan", summary: "Still missing plan steps." };
    }
  };

  try {
    await assert.rejects(
      runTask({
        workspace,
        goal: "recover from repeated invalid steps",
        mode: "advisory",
        successCheck: "Task stops after bounded recovery attempts",
        provider
      }),
      /failed to produce a valid Agent Step after 2 recovery attempts/
    );

    const latestRunPath = join(workspace, ".personal-agent", "runs", "latest");
    const latestRunId = await readFile(latestRunPath, "utf8");
    const events = await readFile(join(workspace, ".personal-agent", "runs", latestRunId.trim(), "events.jsonl"), "utf8");

    assert.equal(callCount, 3);
    assert.equal((events.match(/"type":"recovery"/g) ?? []).length, 2);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runChatTask keeps multiple Owner messages inside one Task Run", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-chat-"));
  const agentMessages: string[] = [];
  const provider: ModelProvider = {
    name: "fake-chat",
    async nextStep(input) {
      const ownerMessages = input.events.filter((event) => event.type === "owner_message");
      if (ownerMessages.length === 1) {
        assert.equal(ownerMessages[0]?.content, "你好");
        return { type: "message", content: "你好，我还在同一个对话里。" };
      }

      assert.equal(ownerMessages.length, 2);
      assert.equal(ownerMessages[1]?.content, "结束");
      assert.ok(input.events.some((event) => event.type === "message" && event.content.includes("同一个对话")));
      return { type: "message", content: "好的，对话会由输入结束来完成。" };
    }
  };

  try {
    const result = await runChatTask({
      workspace,
      provider,
      messages: ["你好", "结束"],
      onAgentMessage(message) {
        agentMessages.push(message);
      }
    });

    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");
    const report = await readFile(join(result.runDir, "report.md"), "utf8");
    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));
    const metadata = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));

    assert.equal(result.status, "completed");
    assert.deepEqual(agentMessages, ["你好，我还在同一个对话里。", "好的，对话会由输入结束来完成。"]);
    assert.equal((events.match(/"type":"owner_message"/g) ?? []).length, 2);
    assert.match(report, /Owner Messages: 2/);
    assert.equal(evaluation.traceQuality, "pass");
    assert.equal(metadata.status, "completed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runChatTask finalizes the chat when input ends", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-chat-active-"));
  const provider: ModelProvider = {
    name: "fake-chat-active",
    async nextStep() {
      return { type: "message", content: "我会等待下一条消息。" };
    }
  };

  try {
    const result = await runChatTask({
      workspace,
      provider,
      messages: ["你好"]
    });

    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");
    const metadata = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));

    assert.equal(result.status, "completed");
    assert.equal(metadata.status, "completed");
    assert.equal(evaluation.verdict, "partial");
    assert.equal(evaluation.taskCorrectness.verdict, "unavailable");
    assert.equal((events.match(/"type":"owner_message"/g) ?? []).length, 1);
    assert.match(events, /"content":"你好"/);
    assert.match(events, /"content":"我会等待下一条消息。"/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runChatTask recovers when a provider tries to finish an active chat turn", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-chat-finish-recovery-"));
  let callCount = 0;
  const provider: ModelProvider = {
    name: "fake-chat-finish-recovery",
    async nextStep(input) {
      callCount += 1;
      assert.equal(input.interaction, "chat");
      if (callCount === 1) {
        return { type: "finish", report: "This must not end the conversation." };
      }
      assert.ok(input.events.some((event) => event.type === "recovery"));
      return { type: "message", content: "我仍然会回答当前消息。" };
    }
  };

  try {
    const result = await runChatTask({ workspace, provider, messages: ["你是什么模型"] });
    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");

    assert.equal(callCount, 2);
    assert.match(events, /Chat interaction cannot return finish/);
    assert.match(events, /我仍然会回答当前消息/);
    assert.equal((events.match(/"type":"finish"/g) ?? []).length, 1);
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

test("runTask passes relevant Skill Pack summaries to the Model Provider", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-skill-packs-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      const skillPacks = (input as typeof input & { skillPacks?: string }).skillPacks ?? "";
      assert.match(skillPacks, /docs-helper/);
      assert.match(skillPacks, /Helps summarize workspace documentation/);
      assert.match(skillPacks, /\.agents\/skills\/docs-helper\/SKILL\.md/);
      assert.match(skillPacks, /\.agents\/skills\/docs-helper\/references\/guide\.md/);
      assert.match(skillPacks, /Use this skill when summarizing docs\./);
      assert.match(skillPacks, /guidance: full SKILL\.md/);
      assert.doesNotMatch(skillPacks, /service-deployer/);
      return { type: "finish", report: "Finished with relevant Skill Pack context." };
    }
  };

  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/docs-helper/references"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/service-deployer"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize workspace documentation and README files.",
        "---",
        "",
        "# Docs Helper",
        "",
        "Use this skill when summarizing docs."
      ].join("\n"),
      "utf8"
    );
    await writeFile(join(workspace, ".agents/skills/docs-helper/references/guide.md"), "# Docs guide\n", "utf8");
    await writeFile(
      join(workspace, ".agents/skills/service-deployer/SKILL.md"),
      [
        "---",
        "name: service-deployer",
        "description: Helps deploy services.",
        "---",
        "",
        "# Deploy Helper"
      ].join("\n"),
      "utf8"
    );

    await runTask({
      workspace,
      goal: "summarize docs with docs-helper",
      mode: "advisory",
      successCheck: "report references documentation",
      provider
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask records selected Skill Packs for Task Export", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-skill-pack-export-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      return { type: "finish", report: "Finished with Skill Pack export context." };
    }
  };

  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize workspace documentation and README files.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );

    const run = await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references documentation",
      skillSelectors: ["docs-helper"],
      provider
    });
    const exported = await exportTaskRun(workspace, run.id);
    assert.ok(exported);
    const markdown = await readFile(exported.path, "utf8");

    assert.match(markdown, /## Skill Packs Used/);
    assert.match(markdown, /docs-helper/);
    assert.match(markdown, /\.agents\/skills\/docs-helper\/SKILL\.md/);
    assert.match(markdown, /guidance: full SKILL\.md loaded/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask asks before loading one automatically inferred Skill Pack", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-single-skill-confirm-"));
  const requests: ConfirmationRequired[] = [];
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.equal(input.skillPacks, undefined);
      return { type: "finish", report: "Finished without inferred Skill guidance." };
    }
  };

  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize docs.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );

    await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references docs",
      provider,
      confirmAction(confirmation) {
        requests.push(confirmation);
        return false;
      }
    });

    assert.equal(requests.length, 1);
    assert.match(requests[0]?.reason ?? "", /one Skill Pack matched automatically/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask asks before injecting multiple automatically matched Skill Packs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-skill-pack-confirm-"));
  const requests: ConfirmationRequired[] = [];
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.equal(input.skillPacks, undefined);
      return { type: "finish", report: "Finished without ambiguous Skill Pack context." };
    }
  };

  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/readme-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize docs.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(workspace, ".agents/skills/readme-helper/SKILL.md"),
      [
        "---",
        "name: readme-helper",
        "description: Helps summarize README docs.",
        "---",
        "",
        "# Readme Helper"
      ].join("\n"),
      "utf8"
    );

    await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references docs",
      provider,
      confirmAction(confirmation) {
        requests.push(confirmation);
        return false;
      }
    });

    const request = requests[0];
    assert.ok(request);
    assert.equal(request.tool, "skill_packs");
    assert.match(request.reason, /multiple Skill Packs/i);
    const skillPacks = request.action.skillPacks;
    assert.ok(Array.isArray(skillPacks));
    assert.deepEqual([...skillPacks].sort(), [
      ".agents/skills/docs-helper/SKILL.md",
      ".agents/skills/readme-helper/SKILL.md"
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask loads an explicitly selected shadowed source while persisting only guidance audit data", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-explicit-source-"));
  const configuredRoot = await mkdtemp(join(tmpdir(), "personal-agent-runner-configured-skills-"));
  const externalMarker = "EXTERNAL FULL GUIDANCE BODY";
  const workspaceMarker = "WORKSPACE FULL GUIDANCE BODY";
  try {
    await mkdir(join(workspace, ".personal-agent"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await mkdir(join(configuredRoot, "docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".personal-agent/config.json"),
      `${JSON.stringify({ skillRoots: [configuredRoot] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      ["---", "name: docs-helper", "description: Shared docs helper.", "---", "", workspaceMarker].join("\n"),
      "utf8"
    );
    await writeFile(
      join(configuredRoot, "docs-helper/SKILL.md"),
      ["---", "name: docs-helper", "description: Shared docs helper.", "---", "", externalMarker].join("\n"),
      "utf8"
    );

    const run = await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references docs",
      skillSelectors: ["configured:1:docs-helper"],
      provider: {
        name: "fake",
        async nextStep(input) {
          assert.match(input.skillPacks ?? "", new RegExp(externalMarker));
          assert.doesNotMatch(input.skillPacks ?? "", new RegExp(workspaceMarker));
          assert.match(input.skillPacks ?? "", /source precedence overridden: yes/);
          return { type: "finish", report: "Finished with configured guidance." };
        }
      }
    });

    const eventsText = await readFile(join(run.runDir, "events.jsonl"), "utf8");
    const metadata = JSON.parse(await readFile(join(run.runDir, "run.json"), "utf8"));
    const skillEvent = eventsText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .map((entry) => entry.event)
      .find((event) => event.type === "skill_packs");

    assert.ok(skillEvent);
    assert.doesNotMatch(eventsText, new RegExp(externalMarker));
    assert.deepEqual(metadata.skillSelectors, ["configured:1:docs-helper"]);
    assert.deepEqual(metadata.selectedSkillPaths, [join(configuredRoot, "docs-helper/SKILL.md")]);
    assert.equal(skillEvent.skillPacks[0].selection.precedenceOverridden, true);
    assert.equal(typeof skillEvent.skillPacks[0].guidance.sha256, "string");
    assert.equal(typeof skillEvent.skillPacks[0].guidance.bytes, "number");
    assert.equal("content" in skillEvent.skillPacks[0].guidance, false);
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(configuredRoot, { recursive: true, force: true });
  }
});

test("runTask rejects an unknown explicit Skill before creating Task Run state", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-missing-skill-"));
  try {
    await assert.rejects(
      runTask({
        workspace,
        goal: "summarize docs",
        mode: "advisory",
        successCheck: "report references docs",
        skillSelectors: ["missing-helper"],
        provider: {
          name: "fake",
          async nextStep() {
            throw new Error("provider should not be called");
          }
        }
      }),
      /Skill Pack not found: missing-helper/
    );
    await assert.rejects(readFile(join(workspace, ".personal-agent/runs/latest"), "utf8"), /ENOENT/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runTask injects only the Skill Packs selected during confirmation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-runner-skill-pack-subset-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.match(input.skillPacks ?? "", /readme-helper/);
      assert.doesNotMatch(input.skillPacks ?? "", /docs-helper/);
      return { type: "finish", report: "Finished with selected Skill Pack context." };
    }
  };

  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/readme-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize docs.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(workspace, ".agents/skills/readme-helper/SKILL.md"),
      [
        "---",
        "name: readme-helper",
        "description: Helps summarize README docs.",
        "---",
        "",
        "# Readme Helper"
      ].join("\n"),
      "utf8"
    );

    await runTask({
      workspace,
      goal: "summarize docs",
      mode: "advisory",
      successCheck: "report references docs",
      provider,
      confirmAction() {
        return {
          approved: true,
          selected: [".agents/skills/readme-helper/SKILL.md"]
        };
      }
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

test("runTask persists malformed Local Tool calls as provider-visible tool errors", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-tool-error-runner-"));
  let observedError: unknown;
  const provider: ModelProvider = {
    name: "fake",
    /** Produces malformed input, then captures the provider-visible recovery evidence. */
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: {} };
      }
      const result = input.events.find(
        (event) => typeof event === "object" && event !== null && "type" in event && event.type === "tool_result"
      );
      if (result && typeof result === "object" && "output" in result) {
        observedError = result.output;
      }
      return { type: "finish", report: "Malformed tool input was recorded." };
    }
  };

  try {
    const result = await runTask({
      workspace,
      goal: "read a missing path argument",
      mode: "advisory",
      successCheck: "Task records the malformed tool call",
      provider
    });
    const events = await readFile(join(result.runDir, "events.jsonl"), "utf8");

    assert.deepEqual(observedError, {
      type: "tool_error",
      tool: "read_file",
      phase: "input_validation",
      reason: "Local Tool read_file input failed schema validation: $.path is required"
    });
    assert.match(events, /"type":"tool_error"/);
    assert.match(events, /"phase":"input_validation"/);
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
    const evaluation = JSON.parse(await readFile(join(result.runDir, "evaluation.json"), "utf8"));

    assert.deepEqual(suggestions, [
      {
        section: "preferences",
        note: "Owner prefers concise CLI output.",
        reason: "Model reflection during the Task Run",
        source: "model_reflect"
      }
    ]);
    assert.deepEqual(evaluation.learningSignals, ["Project Memory suggestion"]);
    assert.deepEqual(evaluation.followUps, ["Review Memory Suggestions"]);
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

test("resumeLatestTask keeps the originally selected external Skill source after precedence changes", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-skill-source-"));
  const configuredRoot = await mkdtemp(join(tmpdir(), "personal-agent-resume-configured-skills-"));
  const externalMarker = "ORIGINAL EXTERNAL GUIDANCE";
  const laterWorkspaceMarker = "LATER WORKSPACE GUIDANCE";
  try {
    await mkdir(join(workspace, ".personal-agent"), { recursive: true });
    await mkdir(join(configuredRoot, "docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".personal-agent/config.json"),
      `${JSON.stringify({ skillRoots: [configuredRoot] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(configuredRoot, "docs-helper/SKILL.md"),
      ["---", "name: docs-helper", "description: Helps with docs.", "---", "", externalMarker].join("\n"),
      "utf8"
    );

    await assert.rejects(
      runTask({
        workspace,
        goal: "summarize docs",
        mode: "advisory",
        successCheck: "report references docs",
        skillSelectors: ["configured:1:docs-helper"],
        provider: {
          name: "pause",
          async nextStep() {
            throw new Error("pause before first model step");
          }
        }
      }),
      /pause before first model step/
    );

    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      ["---", "name: docs-helper", "description: Helps with docs.", "---", "", laterWorkspaceMarker].join("\n"),
      "utf8"
    );

    const resumed = await resumeLatestTask({
      workspace,
      provider: {
        name: "resume",
        async nextStep(input) {
          assert.match(input.skillPacks ?? "", new RegExp(externalMarker));
          assert.doesNotMatch(input.skillPacks ?? "", new RegExp(laterWorkspaceMarker));
          return { type: "finish", report: "Resumed with original external guidance." };
        }
      }
    });

    assert.equal(resumed.status, "completed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(configuredRoot, { recursive: true, force: true });
  }
});

test("resumeLatestTask rejects changed Skill guidance before calling the provider", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-resume-skill-drift-"));
  const skillPath = join(workspace, ".agents/skills/docs-helper/SKILL.md");
  let resumeProviderCalled = false;
  try {
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      skillPath,
      ["---", "name: docs-helper", "description: Helps with docs.", "---", "", "ORIGINAL BODY"].join("\n"),
      "utf8"
    );
    await assert.rejects(
      runTask({
        workspace,
        goal: "summarize docs",
        mode: "advisory",
        successCheck: "report references docs",
        skillSelectors: ["docs-helper"],
        provider: {
          name: "pause",
          async nextStep() {
            throw new Error("pause before first model step");
          }
        }
      }),
      /pause before first model step/
    );

    await writeFile(
      skillPath,
      ["---", "name: docs-helper", "description: Helps with docs.", "---", "", "CHANGED BODY"].join("\n"),
      "utf8"
    );

    await assert.rejects(
      resumeLatestTask({
        workspace,
        provider: {
          name: "resume",
          async nextStep() {
            resumeProviderCalled = true;
            return { type: "finish", report: "Provider should not run." };
          }
        }
      }),
      /Skill Pack guidance changed since Task Run started/
    );
    assert.equal(resumeProviderCalled, false);
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
