import test from "node:test";
import assert from "node:assert/strict";
import { commandErrorResult } from "../../../src/agents/shared/errors.ts";
import type { Agent } from "../../../src/core/types.ts";

const agent: Agent = {
  id: "aiden",
  kind: "aiden",
  label: "Aiden",
  command: "aiden",
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

test("command errors preserve known provider failures as bridge results", () => {
  const result = commandErrorResult(agent, {
    message: "Agent command produced rate_limit output",
    stdout: "429 Gateway retry policy failed: code: rate_limit_reached; Requests have exceeded the throughput limit",
    stderr: ""
  });

  assert.equal(result.verdict, "uncertain");
  assert.equal(result.summary, "Aiden provider rate limit; the consumer CLI returned a 429 instead of a JSON verdict.");
  assert.equal(result.findings[0].title, "Aiden provider rate limit");
});
