import test from "node:test";
import assert from "node:assert/strict";
import { bridgeWorkerSession } from "../../src/bridge/worker-session.ts";
import type { Agent, NormalizedHookPayload } from "../../src/core/types.ts";

const aiden: Agent = {
  id: "aiden",
  kind: "aiden",
  label: "Aiden",
  command: "aiden",
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

test("worker session is stable for the same producer cwd session and consumer", () => {
  const first = bridgeWorkerSession(payload({ sessionId: "s1" }), aiden);
  const second = bridgeWorkerSession(payload({ sessionId: "s1" }), aiden);
  const otherSession = bridgeWorkerSession(payload({ sessionId: "s2" }), aiden);
  const codexConsumer = bridgeWorkerSession(payload({ sessionId: "s1" }), {
    ...aiden,
    id: "codex",
    kind: "codex",
    label: "Codex",
    command: "codex"
  });

  assert.equal(first.id, second.id);
  assert.notEqual(first.id, otherSession.id);
  assert.notEqual(first.id, codexConsumer.id);
  assert.match(first.id, /^codex-aiden-repo-s1-/);
  assert.equal(first.workspace, "/tmp/repo");
  assert.equal(first.sessionId, "s1");
});

function payload(overrides: Partial<NormalizedHookPayload>): NormalizedHookPayload {
  return {
    producer: "codex",
    event: "stop",
    raw: {},
    cwd: "/tmp/repo",
    sessionId: null,
    turnId: null,
    hookEventName: null,
    stopHookActive: false,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    toolResponse: null,
    sender: null,
    mentions: [],
    ...overrides
  };
}
