import test from "node:test";
import assert from "node:assert/strict";
import { detectKnownAgentError, firstKnownAgentErrorLine } from "../../src/core/agent-errors.ts";

test("detects provider rate-limit output", () => {
  const text = "ProviderRetryPolicyExhaustedError: 429 Gateway retry policy failed: code: rate_limit_reached";
  const error = detectKnownAgentError(text);

  assert.equal(error?.kind, "rate_limit");
  assert.equal(firstKnownAgentErrorLine(text, error!), text);
});

test("detects authentication output", () => {
  const text = "Error: Please log in to continue";
  const error = detectKnownAgentError(text);

  assert.equal(error?.kind, "auth");
  assert.equal(error?.title("Aiden"), "Aiden authentication unavailable");
});
