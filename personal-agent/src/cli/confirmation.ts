import { createInterface } from "node:readline/promises";
import type { ConfirmationRequired } from "../tools/local-tools.ts";

/** Formats a confirmation request into console-readable lines for the Owner. */
export function formatConfirmationRequest(request: ConfirmationRequired): string {
  const lines = [
    "[agent] confirmation required",
    `tool: ${request.tool}`,
    `reason: ${request.reason}`,
    `action: ${JSON.stringify(request.action)}`
  ];

  if (request.preview) {
    lines.splice(3, 0, `preview: ${JSON.stringify(request.preview)}`);
  }

  return lines.join("\n");
}

/** Returns whether a terminal answer explicitly approves a gated action. */
export function isApprovalAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

/** Prompts the Owner in the terminal before executing a confirmation-gated action. */
export async function confirmInTerminal(request: ConfirmationRequired): Promise<boolean> {
  process.stderr.write(`${formatConfirmationRequest(request)}\n`);

  if (!process.stdin.isTTY) {
    // Non-interactive runs must not hang waiting for confirmation, so they deny
    // gated actions by default and leave the decision in the Task Run trace.
    process.stderr.write("[agent] confirmation denied because stdin is not interactive\n");
    return false;
  }

  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return isApprovalAnswer(await terminal.question("Approve this action? (y/N) "));
  } finally {
    terminal.close();
  }
}
