import test from "node:test";
import assert from "node:assert/strict";
import { agentAdapters, getAgentAdapter } from "../../../src/agents/registry.ts";

test("registry exposes supported agents", () => {
  assert.deepEqual(agentAdapters.map((adapter) => adapter.kind), ["codex", "claude", "aiden"]);
  assert.equal(getAgentAdapter("codex").label, "Codex");
  assert.equal(getAgentAdapter("claude").label, "Claude Code");
  assert.equal(getAgentAdapter("aiden").label, "Aiden");
});
