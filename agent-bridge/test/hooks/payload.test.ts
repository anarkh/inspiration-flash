import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHookPayload, bridgeHash } from "../../src/hooks/payload.ts";

test("normalizes Codex stop payload", () => {
  const payload = normalizeHookPayload("codex", "stop", {
    cwd: "/repo",
    session_id: "s1",
    turn_id: "t1",
    last_assistant_message: "done"
  });

  assert.equal(payload.cwd, "/repo");
  assert.equal(payload.sessionId, "s1");
  assert.equal(payload.turnId, "t1");
  assert.equal(payload.lastAssistantMessage, "done");
});

test("normalizes sender and mentions metadata", () => {
  const payload = normalizeHookPayload("codex", "stop", {
    cwd: "/repo",
    session_id: "s1",
    sender: {
      type: "user",
      open_id: "ou_user",
      name: "李晨阳"
    },
    mentions: [{
      name: "艾扥",
      open_id: "ou_bot"
    }]
  });

  assert.deepEqual(payload.sender, {
    type: "user",
    openId: "ou_user",
    name: "李晨阳"
  });
  assert.deepEqual(payload.mentions, [{
    name: "艾扥",
    openId: "ou_bot"
  }]);
});

test("hash is stable for same payload", () => {
  const a = normalizeHookPayload("claude", "post-tool-use", { cwd: "/repo", tool_name: "Write" });
  const b = normalizeHookPayload("claude", "post-tool-use", { cwd: "/repo", tool_name: "Write" });
  assert.equal(bridgeHash(a), bridgeHash(b));
});
