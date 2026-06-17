import assert from "node:assert/strict";
import test from "node:test";

import { parseAgentStep } from "../../src/core/agent-step.ts";

test("parseAgentStep accepts a valid message step", () => {
  const step = parseAgentStep({ type: "message", content: "hello" });

  assert.deepEqual(step, { type: "message", content: "hello" });
});

test("parseAgentStep rejects an unknown step type", () => {
  assert.throws(
    () => parseAgentStep({ type: "delegate", target: "other-agent" }),
    /Unknown Agent Step type/
  );
});
