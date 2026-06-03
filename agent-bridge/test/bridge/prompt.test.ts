import test from "node:test";
import assert from "node:assert/strict";
import { buildBridgePrompt, shouldIncludeGitContextForTurn } from "../../src/bridge/prompt.ts";
import type { GitContext, NormalizedHookPayload } from "../../src/core/types.ts";

test("omits shared workspace diff for non-reviewable chat turns", () => {
  const prompt = buildBridgePrompt(payload({
    sessionId: "chat-session",
    lastAssistantMessage: "你好，有什么可以帮你？"
  }), gitContext(), {
    includeGitContext: false,
    gitContextReason: "not reviewable"
  });

  assert.match(prompt, /not reviewable/);
  assert.match(prompt, /Message:\n你好，有什么可以帮你？/);
  assert.doesNotMatch(prompt, /Producer context:/);
  assert.doesNotMatch(prompt, /sessionId/);
  assert.doesNotMatch(prompt, /cwd/);
  assert.doesNotMatch(prompt, /Staged diff:/);
  assert.doesNotMatch(prompt, /export const fromOtherConversation/);
  assert.doesNotMatch(prompt, /src\/other-session\.ts/);
});

test("omits empty git diff sections from review prompts", () => {
  const prompt = buildBridgePrompt(payload({
    lastAssistantMessage: "已修改 src/other-session.ts 并完成实现。"
  }), gitContext());

  assert.match(prompt, /Message:\n已修改 src\/other-session\.ts 并完成实现。/);
  assert.match(prompt, /Changed files:\nsrc\/other-session\.ts/);
  assert.match(prompt, /Unstaged diff:\n[\s\S]*export const fromOtherConversation/);
  assert.doesNotMatch(prompt, /Staged diff:/);
  assert.doesNotMatch(prompt, /Untracked files diff:/);
  assert.doesNotMatch(prompt, /Producer context:/);
});

test("classifies code and non-code turns before attaching git context", () => {
  assert.equal(shouldIncludeGitContextForTurn(payload({
    lastAssistantMessage: "你好，有什么可以帮你？"
  })), false);
  assert.equal(shouldIncludeGitContextForTurn(payload({
    lastAssistantMessage: "已修复 Aiden worker 映射并补充测试。"
  })), true);
  assert.equal(shouldIncludeGitContextForTurn(payload({
    event: "post-tool-use",
    toolName: "Write"
  })), true);
});

function payload(overrides: Partial<NormalizedHookPayload>): NormalizedHookPayload {
  return {
    producer: "codex",
    event: "stop",
    raw: {},
    cwd: "/repo",
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

function gitContext(): GitContext {
  return {
    isGitRepo: true,
    status: " M src/other-session.ts",
    changedFiles: ["src/other-session.ts"],
    diff: [
      "diff --git a/src/other-session.ts b/src/other-session.ts",
      "--- a/src/other-session.ts",
      "+++ b/src/other-session.ts",
      "@@",
      "+export const fromOtherConversation = true;"
    ].join("\n"),
    stagedDiff: "",
    untrackedDiff: ""
  };
}
