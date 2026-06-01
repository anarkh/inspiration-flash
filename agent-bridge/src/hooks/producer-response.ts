import type { EndpointKind, HookEvent, BridgeResponse, BridgeResult } from "../core/types.ts";

export interface ProducerResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function mapBridgeToProducerResponse(
  producer: EndpointKind,
  event: HookEvent,
  response: BridgeResponse
): ProducerResponse {
  if (!response.shouldContinue) {
    return producer === "codex"
      ? { exitCode: 0, stdout: "{}\n", stderr: "" }
      : { exitCode: 0, stdout: "", stderr: "" };
  }

  const report = formatBridgeReport(response.result);
  if (producer === "claude" || producer === "aiden") {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${report}\n`
    };
  }

  if (event === "post-tool-use") {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify({
        decision: "block",
        reason: report,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: report
        }
      })}\n`,
      stderr: ""
    };
  }

  return {
    exitCode: 0,
    stdout: `${JSON.stringify({
      decision: "block",
      reason: report
    })}\n`,
    stderr: ""
  };
}

export function formatBridgeReport(result: BridgeResult): string {
  const findings = result.findings.length > 0
    ? result.findings.map((finding, index) => {
      const location = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})` : "";
      const severity = finding.severity ? `[${finding.severity}] ` : "";
      const detail = finding.detail ? `\n${finding.detail}` : "";
      return `${index + 1}. ${severity}${finding.title}${location}${detail}`;
    }).join("\n\n")
    : "No detailed findings provided.";
  const nextPrompt = result.suggestedPrompt
    ? `\n\nSuggested continuation prompt:\n${result.suggestedPrompt}`
    : "";
  return [
    `AI bridge verdict: ${result.verdict}`,
    "",
    result.summary,
    "",
    "Findings:",
    findings,
    nextPrompt
  ].join("\n");
}
