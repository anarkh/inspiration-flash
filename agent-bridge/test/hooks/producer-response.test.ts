import test from "node:test";
import assert from "node:assert/strict";
import type { BridgeResponse } from "../../src/core/types.ts";
import { mapBridgeToProducerResponse } from "../../src/hooks/producer-response.ts";

const failingResponse: BridgeResponse = {
  shouldContinue: true,
  result: {
    verdict: "fail",
    summary: "Needs another pass.",
    findings: [{ severity: "high", title: "Broken test" }],
    suggestedPrompt: "Fix the broken test."
  }
};

test("maps Codex stop failure to block JSON", () => {
  const response = mapBridgeToProducerResponse("codex", "stop", failingResponse);
  assert.equal(response.exitCode, 0);
  const parsed = JSON.parse(response.stdout);
  assert.equal(parsed.decision, "block");
  assert.match(parsed.reason, /Needs another pass/);
});

test("maps Codex post tool failure to additional context", () => {
  const response = mapBridgeToProducerResponse("codex", "post-tool-use", failingResponse);
  const parsed = JSON.parse(response.stdout);
  assert.equal(parsed.decision, "block");
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
});

test("maps Claude failure to exit code 2 stderr", () => {
  const response = mapBridgeToProducerResponse("claude", "stop", failingResponse);
  assert.equal(response.exitCode, 2);
  assert.equal(response.stdout, "");
  assert.match(response.stderr, /Broken test/);
});

test("maps Aiden failure to exit code 2 stderr", () => {
  const response = mapBridgeToProducerResponse("aiden", "stop", failingResponse);
  assert.equal(response.exitCode, 2);
  assert.equal(response.stdout, "");
  assert.match(response.stderr, /Broken test/);
});

test("maps pass to empty Codex JSON", () => {
  const response = mapBridgeToProducerResponse("codex", "stop", {
    shouldContinue: false,
    result: {
      verdict: "pass",
      summary: "ok",
      findings: [],
      suggestedPrompt: ""
    }
  });
  assert.equal(response.exitCode, 0);
  assert.deepEqual(JSON.parse(response.stdout), {});
});
