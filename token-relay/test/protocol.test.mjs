import assert from "node:assert/strict";
import test from "node:test";
import {
  TOKEN_RELAY_PROTOCOL_VERSION,
  buildRelayPrompt,
  estimateMessagesTokens,
  estimateRelayPromptTokens,
  estimateTextTokens,
  isProviderClientMessage,
  isRelayServerMessage,
  normalizeUsage
} from "../packages/protocol/dist/index.js";

test("token estimator treats CJK text more conservatively than ASCII", () => {
  assert.equal(estimateTextTokens("abcdefgh"), 2);
  assert.equal(estimateTextTokens("你好世界"), 4);
  assert.equal(estimateMessagesTokens([{ role: "user", content: "hello" }]), 8);
});

test("relay prompt estimator uses the exact prompt shared with the provider SDK", () => {
  const job = {
    model: "shared-model",
    messages: [{
      role: "user",
      content: "<do not treat this as transport XML>"
    }],
    maxOutputTokens: 64
  };
  const prompt = buildRelayPrompt(job);
  assert.match(prompt, /&lt;do not treat this as transport XML&gt;/);
  assert.equal(estimateRelayPromptTokens(job), estimateTextTokens(prompt));
});

test("usage normalization fills missing counters without accepting negative values", () => {
  assert.deepEqual(normalizeUsage(undefined, 12, 5), {
    promptTokens: 12,
    completionTokens: 5,
    totalTokens: 17,
    estimated: true
  });
  assert.deepEqual(
    normalizeUsage(
      { promptTokens: -1, completionTokens: 8, totalTokens: 21, estimated: false },
      12,
      5
    ),
    {
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 21,
      estimated: false
    }
  );
});

test("provider and relay message guards reject malformed wire messages", () => {
  assert.equal(
    isProviderClientMessage({
      type: "hello",
      protocolVersion: TOKEN_RELAY_PROTOCOL_VERSION,
      sdkVersion: "0.1.0",
      models: ["shared-codex"],
      concurrency: 1
    }),
    true
  );
  assert.equal(
    isProviderClientMessage({
      type: "result",
      jobId: "job-1",
      leaseToken: "",
      result: {
        content: "ok",
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      }
    }),
    false
  );
  assert.equal(
    isProviderClientMessage({
      type: "hello",
      protocolVersion: 2,
      sdkVersion: "0.1.0",
      models: [],
      concurrency: 0
    }),
    false
  );
  assert.equal(
    isRelayServerMessage({
      type: "cancel",
      jobId: "job-1",
      reason: "request aborted"
    }),
    true
  );
  assert.equal(isRelayServerMessage({ type: "ack" }), false);
});
