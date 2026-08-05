import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createTaskEvaluation } from "../../src/agent/evaluation.ts";
import type { ModelProviderEvent } from "../../src/model/provider.ts";

const completedEvents: ModelProviderEvent[] = [
  { type: "plan", summary: "Produce the expected artifact", steps: ["Finish"] },
  { type: "finish", report: "Completed" }
];

test("Evaluation V2 fails a wrong non-empty report with visible evidence", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-report-"));
  try {
    const evaluation = await createTaskEvaluation({
      workspace,
      successCheck: "Report contains the expected marker",
      successChecks: [{ id: "expected-marker", type: "report_contains", value: "alpha marker" }],
      report: "A polished but incorrect report.",
      events: completedEvents,
      memorySuggestions: []
    });

    assert.equal(evaluation.schemaVersion, 2);
    assert.equal(evaluation.executionIntegrity.verdict, "pass");
    assert.equal(evaluation.taskCorrectness.verdict, "fail");
    assert.equal(evaluation.verdict, "fail");
    assert.equal(evaluation.effectiveVerdict, "fail");
    assert.deepEqual(evaluation.humanOverrides, []);
    assert.equal(evaluation.successCheck, "fail");
    assert.deepEqual(evaluation.taskCorrectness.checks[0], {
      id: "expected-marker",
      verdict: "fail",
      evidence: [
        {
          source: "report",
          reference: "report.md",
          detail: 'Expected text "alpha marker" was not found in the final report.'
        }
      ]
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Evaluation V2 marks correctness unavailable without objective checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-unavailable-"));
  try {
    const evaluation = await createTaskEvaluation({
      workspace,
      successCheck: "Task produces a report",
      report: "A non-empty report is not proof that the task is correct.",
      events: completedEvents,
      memorySuggestions: []
    });

    assert.equal(evaluation.executionIntegrity.verdict, "pass");
    assert.equal(evaluation.taskCorrectness.verdict, "unavailable");
    assert.equal(evaluation.verdict, "partial");
    assert.equal(evaluation.successCheck, "unavailable");
    assert.match(evaluation.taskCorrectness.evidence[0]?.detail ?? "", /No structured Success Check/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Evaluation V2 verifies file content and successful tool evidence", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-artifacts-"));
  try {
    await writeFile(join(workspace, "result.md"), "Alpha marker is present.\n", "utf8");
    const events: ModelProviderEvent[] = [
      ...completedEvents,
      {
        type: "tool_result",
        tool: "write_file",
        output: { type: "file_written", path: "result.md", bytes: 25 }
      }
    ];
    const evaluation = await createTaskEvaluation({
      workspace,
      successCheck: "Expected file and write evidence exist",
      successChecks: [
        { id: "file", type: "file_contains", path: "result.md", value: "alpha marker" },
        { id: "tool", type: "tool_succeeded", tool: "write_file" }
      ],
      report: "The requested file was written.",
      events,
      memorySuggestions: []
    });

    assert.equal(evaluation.taskCorrectness.verdict, "pass");
    assert.equal(evaluation.verdict, "pass");
    assert.deepEqual(
      evaluation.taskCorrectness.checks.map((check) => check.verdict),
      ["pass", "pass"]
    );
    assert.equal(evaluation.taskCorrectness.checks[0]?.evidence[0]?.reference, "result.md");
    assert.match(evaluation.taskCorrectness.checks[1]?.evidence[0]?.reference ?? "", /events\.jsonl#/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Evaluation V2 fails file checks that escape the workspace", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-path-"));
  try {
    const evaluation = await createTaskEvaluation({
      workspace,
      successCheck: "File remains inside workspace",
      successChecks: [
        { id: "escaped-file", type: "file_exists", path: "../outside.md" },
        { id: "escaped-content", type: "file_contains", path: "../outside.md", value: "marker" }
      ],
      report: "The file exists.",
      events: completedEvents,
      memorySuggestions: []
    });

    assert.equal(evaluation.taskCorrectness.verdict, "fail");
    assert.match(evaluation.taskCorrectness.checks[0]?.evidence[0]?.detail ?? "", /escapes workspace/);
    assert.match(evaluation.taskCorrectness.checks[1]?.evidence[0]?.detail ?? "", /escapes workspace/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Evaluation V2 fails file checks when a workspace symlink resolves outside", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-symlink-"));
  const outside = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-outside-"));
  try {
    const outsideFile = join(outside, "outside.md");
    await writeFile(outsideFile, "outside marker\n", "utf8");
    await symlink(outsideFile, join(workspace, "linked.md"));

    const evaluation = await createTaskEvaluation({
      workspace,
      successCheck: "Artifact remains inside workspace",
      successChecks: [{ id: "linked-file", type: "file_exists", path: "linked.md" }],
      report: "The linked file exists.",
      events: completedEvents,
      memorySuggestions: []
    });

    assert.equal(evaluation.taskCorrectness.verdict, "fail");
    assert.match(evaluation.taskCorrectness.checks[0]?.evidence[0]?.detail ?? "", /resolves outside workspace/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("Evaluation V2 fails rejected, malformed, denied, unresolved, non-zero, and unknown tool results", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-evaluation-tool-failures-"));
  const failedOutputs = [
    { type: "rejected" },
    { type: "tool_error", phase: "input_validation" },
    { type: "confirmation_denied" },
    { type: "confirmation_required" },
    { type: "command_result", exitCode: 1 },
    { type: "unexpected_error" }
  ];

  try {
    for (const output of failedOutputs) {
      const events: ModelProviderEvent[] = [
        { type: "plan", summary: "Run the tool", steps: ["Observe result"] },
        { type: "tool_result", tool: "run_command", output },
        { type: "finish", report: "Tool attempt completed." }
      ];
      const evaluation = await createTaskEvaluation({
        workspace,
        successCheck: "Command succeeds",
        successChecks: [{ id: "command", type: "tool_succeeded", tool: "run_command" }],
        report: "Tool attempt completed.",
        events,
        memorySuggestions: []
      });

      assert.equal(evaluation.taskCorrectness.verdict, "fail", JSON.stringify(output));
      assert.equal(evaluation.taskCorrectness.checks[0]?.verdict, "fail", JSON.stringify(output));
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
