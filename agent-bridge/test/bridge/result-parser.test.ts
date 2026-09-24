import test from "node:test";
import assert from "node:assert/strict";
import { parseBridgeOutput, extractTextFromCliOutput, hasBridgeResultJson } from "../../src/bridge/result-parser.ts";

test("parses strict bridge JSON", () => {
  const result = parseBridgeOutput(JSON.stringify({
    verdict: "fail",
    summary: "Bug found",
    findings: [{ severity: "high", title: "Missing guard", file: "src/a.ts", line: 2 }],
    suggestedPrompt: "Fix the guard."
  }), "Codex");

  assert.equal(result.verdict, "fail");
  assert.equal(result.summary, "Bug found");
  assert.equal(result.findings[0].title, "Missing guard");
  assert.equal(result.suggestedPrompt, "Fix the guard.");
});

test("extracts Claude result field before parsing", () => {
  const text = extractTextFromCliOutput(JSON.stringify({
    type: "result",
    result: "{\"verdict\":\"pass\",\"summary\":\"ok\",\"findings\":[],\"suggestedPrompt\":\"\"}"
  }));

  assert.match(text, /"verdict":"pass"/);
});

test("parses Claude result field embedded in terminal output", () => {
  const output = [
    "# Agent Bridge tmux terminal",
    "$ claude -p --output-format json",
    JSON.stringify({
      type: "result",
      result: "{\"verdict\":\"pass\",\"summary\":\"claude connection ok\",\"findings\":[],\"suggestedPrompt\":\"\"}"
    }),
    "# agent-bridge command exit code 0"
  ].join("\n");

  const result = parseBridgeOutput(output, "Claude Code");
  assert.equal(result.verdict, "pass");
  assert.equal(result.summary, "claude connection ok");
});

test("parses final verdict JSON from terminal output with earlier JSON snippets", () => {
  const output = [
    "# Agent Bridge tmux terminal",
    "$ aiden 'Return strict JSON only: {\"verdict\":\"pass\",\"summary\":\"shape only\"}'",
    "Producer context:",
    "{\"producer\":\"codex\",\"event\":\"stop\"}",
    "{\"verdict\":\"fail\",\"summary\":\"real finding\",\"findings\":[{\"title\":\"Bug\"}],\"suggestedPrompt\":\"fix it\"}",
    "# process exited with code 0"
  ].join("\n");

  const result = parseBridgeOutput(output, "Aiden");
  assert.equal(result.verdict, "fail");
  assert.equal(result.summary, "real finding");
  assert.equal(result.findings[0].title, "Bug");
});

test("parses final verdict JSON after a truncated earlier object", () => {
  const output = [
    "$ aiden 'Untracked diff: +{ \"hooks\": { \"Stop\": [ ... [truncated 10000 chars]'",
    "{\"verdict\":\"fail\",\"summary\":\"late json\",\"findings\":[],\"suggestedPrompt\":\"fix\"}",
    "# process exited with code 0"
  ].join("\n");

  const result = parseBridgeOutput(output, "Aiden");
  assert.equal(result.verdict, "fail");
  assert.equal(result.summary, "late json");
});

test("detects final result JSON in large terminal history", () => {
  const noisyHistory = Array.from({ length: 5000 }, (_, index) => [
    `diff line ${index}: +{`,
    `screen refresh ${index}: {"producer":"codex","event":"stop"}`,
    "Reasoning... esc to interrupt"
  ].join("\n")).join("\n");
  const output = [
    noisyHistory,
    "✦ {\"verdict\":\"pass\",\"summary\":\"tail json\",\"findings\":[],\"suggestedPrompt\":\"\"}",
    "agent full mode (shift + tab to toggle)"
  ].join("\n");

  assert.equal(hasBridgeResultJson(output), true);
  const result = parseBridgeOutput(output, "Aiden");
  assert.equal(result.verdict, "pass");
  assert.equal(result.summary, "tail json");
});

test("parses Aiden terminal-wrapped JSON strings", () => {
  const output = [
    "✦ {\"verdict\":\"pass\",\"summary\":\"No code or plan changes were produced; the producer's prompt is readable and there are",
    "  no diffs to audit.\",\"findings\":[{\"severity\":\"info\",\"title\":\"No changes to review\",\"detail\":\"The workspace is not a",
    "  git repository and the provided diffs are empty.\"}],\"suggestedPrompt\":\"\"}",
    "",
    "· Computing…"
  ].join("\n");

  assert.equal(hasBridgeResultJson(output), true);
  const result = parseBridgeOutput(output, "Aiden");
  assert.equal(result.verdict, "pass");
  assert.match(result.summary, /no diffs to audit/);
  assert.equal(result.findings[0].title, "No changes to review");
});

test("marks unstructured output uncertain", () => {
  const result = parseBridgeOutput("Looks fine, maybe.", "Claude Code");
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.findings[0].title, "Unstructured agent output");
});

test("treats unstructured chat-mode output as a successful answer", () => {
  const result = parseBridgeOutput("Plain answer\nwith detail.", "Claude Code", { mode: "chat" });
  assert.equal(result.verdict, "pass");
  assert.equal(result.summary, "Plain answer\nwith detail.");
  assert.deepEqual(result.findings, []);
  assert.equal(result.suggestedPrompt, "");
  assert.equal(result.rawOutput, "Plain answer\nwith detail.");
});

test("extracts Claude plain result from terminal output in chat mode", () => {
  const output = [
    "# Agent Bridge tmux terminal",
    "$ claude -p --output-format json",
    JSON.stringify({
      type: "result",
      result: "persistent claude chat worker ok"
    }),
    "# agent-bridge command exit code 0"
  ].join("\n");

  const result = parseBridgeOutput(output, "Claude Code", { mode: "chat" });
  assert.equal(result.verdict, "pass");
  assert.equal(result.summary, "persistent claude chat worker ok");
  assert.match(result.rawOutput ?? "", /Agent Bridge tmux terminal/);
});

test("treats an empty Claude chat result as uncertain", () => {
  const output = [
    "# Agent Bridge tmux terminal",
    JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "" }),
    "# agent-bridge command exit code 0"
  ].join("\n");

  const result = parseBridgeOutput(output, "Claude Code", { mode: "chat" });
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.summary, "Agent returned empty output.");
  assert.match(result.rawOutput ?? "", /Agent Bridge tmux terminal/);
});

test("keeps known-error phrases inside a successful Claude chat result", () => {
  const output = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "Unauthorized request means the caller lacks valid credentials."
  });

  const result = parseBridgeOutput(output, "Claude Code", { mode: "chat" });
  assert.equal(result.verdict, "pass");
  assert.match(result.summary, /Unauthorized request/);
});

test("keeps known-error phrases inside a successful plain chat answer", () => {
  const result = parseBridgeOutput("Unauthorized request is the phrase shown by the example.", "Aiden", { mode: "chat" });

  assert.equal(result.verdict, "pass");
  assert.match(result.summary, /Unauthorized request/);
});

test("surfaces Claude error envelopes as uncertain chat results", () => {
  const output = JSON.stringify({
    type: "result",
    subtype: "error_max_turns",
    is_error: true,
    errors: ["Reached maximum number of turns (3)"]
  });

  const result = parseBridgeOutput(output, "Claude Code", { mode: "chat" });
  assert.equal(result.verdict, "uncertain");
  assert.match(result.summary, /maximum turn limit/);
  assert.match(result.findings[0].detail ?? "", /maximum number of turns/);
});

test("does not treat an arbitrary trailing JSON example as a CLI envelope in chat mode", () => {
  const output = "Use this example:\n{\"content\":\"only the example\"}";
  const result = parseBridgeOutput(output, "Claude Code", { mode: "chat" });

  assert.equal(result.verdict, "pass");
  assert.equal(result.summary, output);
});

test("summarizes provider rate limits", () => {
  const result = parseBridgeOutput("429 Gateway retry policy failed: code: rate_limit_reached; Requests have exceeded the throughput limit", "Aiden");
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.summary, "Aiden provider rate limit; the consumer CLI returned a 429 instead of a JSON verdict.");
  assert.equal(result.findings[0].title, "Aiden provider rate limit");
});

test("summarizes consumer authentication failures", () => {
  const result = parseBridgeOutput("Error: Please log in to continue", "Aiden");
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.summary, "Aiden authentication is unavailable in the hook environment, so the consumer CLI could not produce a JSON verdict.");
  assert.equal(result.findings[0].title, "Aiden authentication unavailable");

  const claude = parseBridgeOutput("API Error: 401 Invalid authentication credentials", "Claude Code");
  assert.equal(claude.verdict, "uncertain");
  assert.equal(claude.summary, "Claude Code authentication is unavailable in the hook environment, so the consumer CLI could not produce a JSON verdict.");
  assert.equal(claude.findings[0].title, "Claude Code authentication unavailable");
});
