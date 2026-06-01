import test from "node:test";
import assert from "node:assert/strict";
import { parseBridgeOutput, extractTextFromCliOutput } from "../../src/bridge/result-parser.ts";

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

test("marks unstructured output uncertain", () => {
  const result = parseBridgeOutput("Looks fine, maybe.", "Claude Code");
  assert.equal(result.verdict, "uncertain");
  assert.equal(result.findings[0].title, "Unstructured agent output");
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
});
