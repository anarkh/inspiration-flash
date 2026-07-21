import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { selectRelevantSkillPacks } from "../../src/skills/skill-packs.ts";

test("selectRelevantSkillPacks prioritizes an explicitly named Skill Pack", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-explicit-"));
  try {
    await mkdir(join(workspace, ".agents/skills/rare-helper"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/docs-helper"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/rare-helper/SKILL.md"),
      [
        "---",
        "name: rare-helper",
        "description: Handles calendar operations.",
        "---",
        "",
        "# Rare Helper"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(workspace, ".agents/skills/docs-helper/SKILL.md"),
      [
        "---",
        "name: docs-helper",
        "description: Helps summarize docs and documentation.",
        "---",
        "",
        "# Docs Helper"
      ].join("\n"),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "Use rare-helper skill to summarize docs.",
      successCheck: "report references docs",
      maxSkillPacks: 1
    });

    assert.match(context, /rare-helper/);
    assert.doesNotMatch(context, /docs-helper/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks includes agent-ability resource inventory", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-resources-"));
  try {
    await mkdir(join(workspace, ".agents/skills/video-advisor/scripts"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/video-advisor/references"), { recursive: true });
    await mkdir(join(workspace, ".agents/skills/video-advisor/evals"), { recursive: true });
    await writeFile(
      join(workspace, ".agents/skills/video-advisor/SKILL.md"),
      [
        "---",
        "name: video-advisor",
        "description: Helps answer video index questions.",
        "---",
        "",
        "# Video Advisor"
      ].join("\n"),
      "utf8"
    );
    await writeFile(join(workspace, ".agents/skills/video-advisor/scripts/search_index.py"), "print('search')\n", "utf8");
    await writeFile(join(workspace, ".agents/skills/video-advisor/references/index.md"), "# Index\n", "utf8");
    await writeFile(
      join(workspace, ".agents/skills/video-advisor/evals/evals.json"),
      JSON.stringify(
        {
          skill_name: "video-advisor",
          evals: [
            {
              id: 1,
              prompt: "Answer a video index question.",
              expected_output: "Uses the local index and cites source links.",
              files: []
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer video index questions",
      successCheck: "report references video index"
    });

    assert.match(context, /resource inventory/);
    assert.match(context, /scripts are inventory only and are not auto-executed/);
    assert.match(context, /\.agents\/skills\/video-advisor\/scripts\/search_index\.py/);
    assert.match(context, /\.agents\/skills\/video-advisor\/references\/index\.md/);
    assert.match(context, /\.agents\/skills\/video-advisor\/evals\/evals\.json/);
    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace eval graders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-"));
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
              id: "tool-trace-1",
              prompt: "Read a workspace note before answering.",
              expected_output: "read_file was called",
              grader: { type: "tool_trace", tool: "read_file" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace input_contains checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-input-"));
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
              id: "tool-trace-input-1",
              prompt: "Read a workspace note before answering.",
              expected_output: "read_file was called with notes.md",
              grader: { type: "tool_trace", tool: "read_file", input_contains: "notes.md" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace input_matches checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-input-matches-"));
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
              id: "tool-trace-input-matches-1",
              prompt: "Read a workspace note before answering.",
              expected_output: "read_file was called with a matching input object",
              grader: { type: "tool_trace", tool: "read_file", input_matches: { path: "notes.md" } }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace output_contains checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-output-"));
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
              id: "tool-trace-output-1",
              prompt: "Read a workspace note before answering.",
              expected_output: "read_file returned alpha marker",
              grader: { type: "tool_trace", tool: "read_file", output_contains: "alpha marker" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace output_matches checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-output-matches-"));
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
              id: "tool-trace-output-matches-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command returned a successful command result",
              grader: {
                type: "tool_trace",
                tool: "run_command",
                output_matches: { type: "command_result", exitCode: 0 }
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace output_type checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-output-type-"));
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
              id: "tool-trace-output-type-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command returned an object result",
              grader: { type: "tool_trace", tool: "run_command", output_type: "object" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts tool_trace input_schema and output_schema checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-tool-trace-schemas-"));
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
              id: "tool-trace-input-schema-1",
              prompt: "Read a workspace note before answering.",
              expected_output: "read_file input matched the declared schema",
              grader: {
                type: "tool_trace",
                tool: "read_file",
                input_schema: {
                  type: "object",
                  required: ["path"],
                  properties: { path: { type: "string" } }
                }
              }
            },
            {
              id: "tool-trace-output-schema-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command output matched the declared schema",
              grader: {
                type: "tool_trace",
                tool: "run_command",
                output_schema: {
                  type: "object",
                  required: ["type", "exitCode"],
                  properties: {
                    type: { type: "string" },
                    exitCode: { type: "number" }
                  }
                }
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(2 evals\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts model_judge eval graders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-model-judge-"));
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
              id: "model-judge-1",
              prompt: "Answer docs with limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites docs and includes limitations."
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks accepts model_judge repeated-run thresholds", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-model-judge-threshold-"));
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
              id: "model-judge-threshold-1",
              prompt: "Answer docs with limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites docs and includes limitations.",
                judge_runs: 3,
                pass_threshold: 2
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: valid \(1 eval\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks reports invalid eval manifest graders", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-invalid-eval-"));
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
              id: "bad-grader",
              prompt: "Answer docs.",
              expected_output: "ok",
              grader: { type: "regex" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: invalid \(regex grader pattern must be a non-empty string\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks reports missing eval manifest skill_name", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-missing-eval-name-"));
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
          evals: [{ id: "case-1", prompt: "Answer docs.", expected_output: "ok" }]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: invalid \(missing skill_name\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks reports eval manifests with unknown fields", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-unknown-eval-field-"));
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
          evals: [{ id: "case-1", prompt: "Answer docs.", expected_output: "ok" }],
          owner_notes: "draft-only metadata should not enter the manifest contract"
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: invalid \(unknown manifest field owner_notes\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks reports eval manifests with invalid files arrays", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-invalid-files-"));
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
              id: "case-1",
              prompt: "Answer docs.",
              expected_output: "ok",
              files: ["references/guide.md", 7]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: invalid \(eval case files must be an array of strings\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks reports eval manifests with empty required strings", async () => {
  const invalidCases = [
    { field: "id", evalCase: { id: "", prompt: "Answer docs.", expected_output: "ok" } },
    { field: "prompt", evalCase: { id: "case-1", prompt: "", expected_output: "ok" } },
    { field: "expected_output", evalCase: { id: "case-1", prompt: "Answer docs.", expected_output: "" } }
  ];

  for (const invalidCase of invalidCases) {
    const workspace = await mkdtemp(join(tmpdir(), `personal-agent-skill-packs-empty-${invalidCase.field}-`));
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
            evals: [invalidCase.evalCase]
          },
          null,
          2
        ),
        "utf8"
      );

      const context = await selectRelevantSkillPacks({
        workspace,
        goal: "answer docs",
        successCheck: "report references documentation"
      });

      assert.match(
        context,
        /eval manifest: invalid \(eval case requires non-empty id, prompt, and expected_output\)/
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
});

test("selectRelevantSkillPacks reports multiple eval manifest case errors", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-multi-error-"));
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
            { id: "case-1", prompt: "Answer docs.", expected_output: "" },
            { id: "case-2", prompt: "Answer docs.", expected_output: "ok", files: ["references/guide.md", 7] }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /multiple eval case errors/);
    assert.match(context, /eval 1 requires non-empty id, prompt, and expected_output/);
    assert.match(context, /eval 2 files must be an array of strings/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("selectRelevantSkillPacks explains empty regex grader patterns", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-packs-empty-regex-pattern-"));
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
              id: "case-1",
              prompt: "Answer docs.",
              expected_output: "ok",
              grader: { type: "regex", pattern: "" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const context = await selectRelevantSkillPacks({
      workspace,
      goal: "answer docs",
      successCheck: "report references documentation"
    });

    assert.match(context, /eval manifest: invalid \(regex grader pattern must be a non-empty string\)/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
