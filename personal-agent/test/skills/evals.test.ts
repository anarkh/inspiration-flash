import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runSkillPackEvals } from "../../src/skills/evals.ts";
import type { ModelProvider } from "../../src/model/provider.ts";

test("runSkillPackEvals executes manifest cases and writes local reports", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-"));
  const providerInputs: Array<{ goal: string; skillPacks?: string }> = [];
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      providerInputs.push({ goal: input.goal, skillPacks: input.skillPacks });
      return {
        type: "finish",
        report: "I used the docs-helper Skill Pack. Expected phrase: citations included."
      };
    }
  };

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
              id: "docs-1",
              prompt: "Answer the docs question with citations.",
              expected_output: "citations included",
              files: []
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.status, "completed");
    assert.equal(result.skillPack.name, "docs-helper");
    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
    assert.match(providerInputs[0]?.goal ?? "", /Use docs-helper Skill Pack/);
    assert.match(providerInputs[0]?.goal ?? "", /Answer the docs question with citations/);
    assert.match(providerInputs[0]?.skillPacks ?? "", /docs-helper/);
    assert.match(providerInputs[0]?.skillPacks ?? "", /Full SKILL\.md Guidance/);
    const taskRunMetadata = JSON.parse(
      await readFile(join(result.cases[0]?.taskRunDir ?? "", "run.json"), "utf8")
    );
    assert.deepEqual(taskRunMetadata.skillSelectors, [".agents/skills/docs-helper/SKILL.md"]);
    assert.match(await readFile(result.reportPath, "utf8"), /PASS/);
    assert.match(await readFile(result.resultsPath, "utf8"), /"passedCount": 1/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals executes a configured external Skill Pack without copying it", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-external-skill-workspace-"));
  const configuredRepository = await mkdtemp(join(tmpdir(), "personal-agent-external-skill-source-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      assert.match(input.skillPacks ?? "", /portable-eval-helper/);
      assert.match(input.skillPacks ?? "", /source: configured\[1\]/);
      return { type: "finish", report: "Portable external eval marker: complete." };
    }
  };

  try {
    const skillDir = join(configuredRepository, ".agents/skills/portable-eval-helper");
    await mkdir(join(workspace, ".personal-agent"), { recursive: true });
    await mkdir(join(skillDir, "evals"), { recursive: true });
    await writeFile(
      join(workspace, ".personal-agent/config.json"),
      `${JSON.stringify({ skillRoots: [configuredRepository] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: portable-eval-helper",
        "version: 1.0.0",
        "description: Runs a portable external Skill Pack evaluation.",
        "---",
        "",
        "# Portable Eval Helper"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      join(skillDir, "evals/evals.json"),
      JSON.stringify(
        {
          skill_name: "portable-eval-helper",
          evals: [
            {
              id: "portable-1",
              prompt: "Return the portable external eval marker.",
              expected_output: "Portable external eval marker: complete."
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({
      workspace,
      skillPack: "portable-eval-helper",
      provider
    });

    assert.equal(result.skillPack.source.kind, "configured");
    assert.equal(result.skillPack.version, "1.0.0");
    assert.ok(result.manifestPath.startsWith(configuredRepository));
    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(configuredRepository, { recursive: true, force: true });
  }
});

test("runSkillPackEvals records failed cases when the report misses expected output", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      return { type: "finish", report: "The answer omitted the required marker." };
    }
  };

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
          evals: [{ id: 1, prompt: "Answer docs.", expected_output: "must include this marker" }]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: ".agents/skills/docs-helper/SKILL.md", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /expected output not found/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports regex graders for deterministic report checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-regex-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      return { type: "finish", report: "The answer cited 2 source links." };
    }
  };

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
              id: "regex-1",
              prompt: "Answer docs with source links.",
              expected_output: "source citations are present",
              grader: { type: "regex", pattern: "cited\\s+\\d+\\s+source links" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
    assert.equal(result.cases[0]?.grader, "regex");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace graders for tool-use checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");
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
              prompt: "Read the workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.grader, "tool_trace");
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace input_contains checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");
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
              prompt: "Read the workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace input_contains checks when tool input differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "other.md" } };
      }
      return { type: "finish", report: "The task read a different workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "other.md"), "beta\n", "utf8");
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
              id: "tool-trace-input-fail-1",
              prompt: "Read the required workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /input did not include notes\.md/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace input_matches checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-matches-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md", encoding: "utf8" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");
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
              prompt: "Read the workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace input_matches checks when structured input differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-matches-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "other.md", encoding: "utf8" } };
      }
      return { type: "finish", report: "The task read a different workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "other.md"), "beta\n", "utf8");
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
              id: "tool-trace-input-matches-fail-1",
              prompt: "Read the required workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /input did not match/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace input_schema checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-schema-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");
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
              prompt: "Read the workspace note before answering.",
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
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace input_schema checks when required input is missing", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-input-schema-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha\n", "utf8");
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
              id: "tool-trace-input-schema-fail-1",
              prompt: "Read the workspace note before answering.",
              expected_output: "read_file input included encoding",
              grader: {
                type: "tool_trace",
                tool: "read_file",
                input_schema: {
                  type: "object",
                  required: ["path", "encoding"],
                  properties: { path: { type: "string" }, encoding: { type: "string" } }
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /input did not match schema/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace output_contains checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "alpha marker\n", "utf8");
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
              prompt: "Read the workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace output_contains checks when output differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "read_file", input: { path: "notes.md" } };
      }
      return { type: "finish", report: "The task used the workspace note." };
    }
  };

  try {
    await writeFile(join(workspace, "notes.md"), "beta marker\n", "utf8");
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
              id: "tool-trace-output-fail-1",
              prompt: "Read the required workspace note before answering.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /output did not include alpha marker/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace output_matches checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-matches-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace output_matches checks when structured output differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-matches-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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
              id: "tool-trace-output-matches-fail-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command returned a failing command result",
              grader: {
                type: "tool_trace",
                tool: "run_command",
                output_matches: { type: "command_result", exitCode: 1 }
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /output did not match/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace output_type checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-type-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace output_type checks when the output type differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-type-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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
              id: "tool-trace-output-type-fail-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command returned an array result",
              grader: { type: "tool_trace", tool: "run_command", output_type: "array" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /output type was not array/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports tool_trace output_schema checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-schema-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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
              id: "tool-trace-output-schema-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command output matched the declared schema",
              grader: {
                type: "tool_trace",
                tool: "run_command",
                output_schema: {
                  type: "object",
                  required: ["type", "exitCode", "stdout"],
                  properties: {
                    type: { type: "string" },
                    exitCode: { type: "number" },
                    stdout: { type: "string" }
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails tool_trace output_schema checks when the output shape differs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-tool-trace-output-schema-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.turn === 1) {
        return { type: "tool", tool: "run_command", input: { command: "pwd" } };
      }
      return { type: "finish", report: "The task inspected the workspace path." };
    }
  };

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
              id: "tool-trace-output-schema-fail-1",
              prompt: "Inspect the workspace path before answering.",
              expected_output: "run_command output included a duration",
              grader: {
                type: "tool_trace",
                tool: "run_command",
                output_schema: {
                  type: "object",
                  required: ["durationMs"],
                  properties: { durationMs: { type: "number" } }
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /output did not match schema/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports model_judge graders for semantic report checks", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-"));
  const judgeGoals: string[] = [];
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        judgeGoals.push(input.goal);
        return { type: "finish", report: JSON.stringify({ verdict: "pass", reason: "report satisfies the rubric" }) };
      }
      return {
        type: "finish",
        report: "The answer cites the product docs and clearly names the documented limitation."
      };
    }
  };

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
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation."
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
    assert.equal(result.cases[0]?.grader, "model_judge");
    assert.match(judgeGoals[0] ?? "", /Pass only if the report cites product docs/);
    assert.match(judgeGoals[0] ?? "", /The answer cites the product docs/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails model_judge graders when the judge returns fail", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-fail-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        return { type: "finish", report: JSON.stringify({ verdict: "fail", reason: "missing limitation" }) };
      }
      return { type: "finish", report: "The answer cites the product docs but omits limitations." };
    }
  };

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
              id: "model-judge-fail-1",
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation."
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /missing limitation/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals supports model_judge repeated runs with a pass threshold", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-threshold-"));
  const judgeVerdicts = ["pass", "fail", "pass"];
  let judgeCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        const verdict = judgeVerdicts[judgeCalls] ?? "fail";
        judgeCalls += 1;
        return { type: "finish", report: JSON.stringify({ verdict, reason: `judge ${judgeCalls}` }) };
      }
      return {
        type: "finish",
        report: "The answer cites the product docs and clearly names the documented limitation."
      };
    }
  };

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
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
    assert.equal(judgeCalls, 3);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals fails model_judge repeated runs below the pass threshold", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-threshold-fail-"));
  const judgeVerdicts = ["pass", "fail", "fail"];
  let judgeCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        const verdict = judgeVerdicts[judgeCalls] ?? "fail";
        judgeCalls += 1;
        return { type: "finish", report: JSON.stringify({ verdict, reason: `judge ${judgeCalls}` }) };
      }
      return { type: "finish", report: "The answer cites the product docs but omits limitations." };
    }
  };

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
              id: "model-judge-threshold-fail-1",
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.equal(judgeCalls, 3);
    assert.match(result.cases[0]?.reason ?? "", /model_judge passed 1\/3 below threshold 2/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals records model_judge verdict details in JSON and Markdown reports", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-details-"));
  const judgeReports = [
    JSON.stringify({ verdict: "pass", reason: "complete answer" }),
    "not a JSON verdict",
    JSON.stringify({ verdict: "pass", reason: "limitations included" })
  ];
  let judgeCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        const report = judgeReports[judgeCalls] ?? JSON.stringify({ verdict: "fail", reason: "extra call" });
        judgeCalls += 1;
        return { type: "finish", report };
      }
      return {
        type: "finish",
        report: "The answer cites the product docs and clearly names the documented limitation."
      };
    }
  };

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
              id: "model-judge-details-1",
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation.",
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

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });
    const persisted = JSON.parse(await readFile(result.resultsPath, "utf8"));
    const report = await readFile(result.reportPath, "utf8");

    assert.equal(result.passedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.equal(result.cases[0]?.status, "passed");
    assert.deepEqual(result.cases[0]?.judge, {
      runs: 3,
      passThreshold: 2,
      passedCount: 2,
      verdicts: [
        { verdict: "pass", reason: "complete answer" },
        { verdict: "invalid", reason: "model_judge did not return a JSON object verdict" },
        { verdict: "pass", reason: "limitations included" }
      ]
    });
    assert.deepEqual(persisted.cases[0].judge, result.cases[0]?.judge);
    assert.match(report, /judge: 2\/3 pass \(threshold 2\)/);
    assert.match(report, /judge run 2: invalid - model_judge did not return a JSON object verdict/);
    assert.equal(judgeCalls, 3);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals records invalid model_judge verdicts when judge output is malformed", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-model-judge-invalid-"));
  const provider: ModelProvider = {
    name: "fake",
    async nextStep(input) {
      if (input.goal.startsWith("Judge Skill Pack eval case")) {
        return { type: "finish", report: JSON.stringify({ verdict: "maybe", reason: "uncertain" }) };
      }
      return {
        type: "finish",
        report: "The answer cites the product docs, but the judge response is malformed."
      };
    }
  };

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
              id: "model-judge-invalid-1",
              prompt: "Answer the docs question and include limitations.",
              expected_output: "answer cites docs and limitations",
              grader: {
                type: "model_judge",
                rubric: "Pass only if the report cites product docs and names a documented limitation."
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await runSkillPackEvals({ workspace, skillPack: "docs-helper", provider });

    assert.equal(result.passedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.cases[0]?.status, "failed");
    assert.match(result.cases[0]?.reason ?? "", /model_judge verdict must be pass or fail/);
    assert.deepEqual(result.cases[0]?.judge, {
      runs: 1,
      passThreshold: 1,
      passedCount: 0,
      verdicts: [{ verdict: "invalid", reason: "model_judge verdict must be pass or fail" }]
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects invalid grader declarations before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-invalid-grader-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
          evals: [{ id: 1, prompt: "Answer docs.", expected_output: "ok", grader: { type: "remote_judge" } }]
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /unsupported grader/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects manifests without a skill_name before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-missing-name-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
          evals: [{ id: 1, prompt: "Answer docs.", expected_output: "ok" }]
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /missing skill_name/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects unknown manifest fields before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-unknown-manifest-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
          evals: [{ id: 1, prompt: "Answer docs.", expected_output: "ok" }],
          owner_notes: "draft-only metadata should not enter the manifest contract"
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /unknown manifest field owner_notes/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects unknown eval case fields before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-unknown-case-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
              id: 1,
              prompt: "Answer docs.",
              expected_output: "ok",
              notes: "case metadata belongs in a reference file, not evals.json"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /eval 1 has unknown field notes/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects files arrays with non-string entries before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-invalid-files-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
              id: 1,
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

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /eval 1 files must be an array of strings/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals rejects empty required string fields before running cases", async () => {
  const invalidCases = [
    { field: "id", evalCase: { id: "", prompt: "Answer docs.", expected_output: "ok" } },
    { field: "prompt", evalCase: { id: "case-1", prompt: "", expected_output: "ok" } },
    { field: "expected_output", evalCase: { id: "case-1", prompt: "Answer docs.", expected_output: "" } }
  ];

  for (const invalidCase of invalidCases) {
    const workspace = await mkdtemp(join(tmpdir(), `personal-agent-skill-evals-empty-${invalidCase.field}-`));
    let providerCalls = 0;
    const provider: ModelProvider = {
      name: "fake",
      async nextStep() {
        providerCalls += 1;
        return { type: "finish", report: "ok" };
      }
    };

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

      await assert.rejects(
        runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
        /eval 1 requires non-empty id, prompt, and expected_output/
      );
      assert.equal(providerCalls, 0);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
});

test("runSkillPackEvals rejects unknown grader fields before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-unknown-grader-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
              id: 1,
              prompt: "Answer docs.",
              expected_output: "ok",
              grader: { type: "contains", value: "ok" }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /eval 1 has unknown grader field value/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals explains empty regex grader patterns before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-empty-regex-pattern-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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
              id: 1,
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

    await assert.rejects(
      runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }),
      /eval 1 regex grader pattern must be a non-empty string/
    );
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("runSkillPackEvals reports multiple eval case errors before running cases", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "personal-agent-skill-evals-multi-error-"));
  let providerCalls = 0;
  const provider: ModelProvider = {
    name: "fake",
    async nextStep() {
      providerCalls += 1;
      return { type: "finish", report: "ok" };
    }
  };

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

    await assert.rejects(runSkillPackEvals({ workspace, skillPack: "docs-helper", provider }), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /multiple eval case errors/);
      assert.match(error.message, /eval 1 requires non-empty id, prompt, and expected_output/);
      assert.match(error.message, /eval 2 files must be an array of strings/);
      return true;
    });
    assert.equal(providerCalls, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
