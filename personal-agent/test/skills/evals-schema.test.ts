import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("skill eval manifest schema documents the optional quality-layer contract", async () => {
  const schema = JSON.parse(
    await readFile(join(root, "schemas/skill-evals.schema.json"), "utf8")
  ) as Record<string, unknown>;

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schema.required, ["skill_name", "evals"]);
  assert.match(String(schema.description), /optional Personal Agent quality layer/);
  assert.match(JSON.stringify(schema), /expected_output/);
  assert.match(JSON.stringify(schema), /contains/);
  assert.match(JSON.stringify(schema), /regex/);
  assert.match(JSON.stringify(schema), /tool_trace/);
  assert.match(JSON.stringify(schema), /input_contains/);
  assert.match(JSON.stringify(schema), /input_matches/);
  assert.match(JSON.stringify(schema), /output_contains/);
  assert.match(JSON.stringify(schema), /output_matches/);
  assert.match(JSON.stringify(schema), /output_type/);
  assert.match(JSON.stringify(schema), /input_schema/);
  assert.match(JSON.stringify(schema), /output_schema/);
  assert.match(JSON.stringify(schema), /model_judge/);
  assert.match(JSON.stringify(schema), /rubric/);
  assert.match(JSON.stringify(schema), /judge_runs/);
  assert.match(JSON.stringify(schema), /pass_threshold/);
});
