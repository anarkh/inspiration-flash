import { createInterface } from "node:readline/promises";
import type { ConfirmationRequired, ConfirmationResponse } from "../tools/local-tools.ts";

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
  const options = formatSkillPackSelectionOptions(request);
  if (options.length > 0) {
    lines.splice(lines.length - 1, 0, "options:", ...options);
  }

  return lines.join("\n");
}

/** Returns whether a terminal answer explicitly approves a gated action. */
export function isApprovalAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

/** Parses a terminal answer into a boolean approval or selected option ids. */
export function parseConfirmationAnswer(answer: string, request: ConfirmationRequired): ConfirmationResponse {
  if (isApprovalAnswer(answer)) {
    return true;
  }
  const selected = parseSkillPackSelectionAnswer(answer, request);
  if (selected.length > 0) {
    return { approved: true, selected };
  }
  return false;
}

/** Prompts the Owner in the terminal before executing a confirmation-gated action. */
export async function confirmInTerminal(request: ConfirmationRequired): Promise<ConfirmationResponse> {
  process.stderr.write(`${formatConfirmationRequest(request)}\n`);

  if (!process.stdin.isTTY) {
    // Non-interactive runs must not hang waiting for confirmation, so they deny
    // gated actions by default and leave the decision in the Task Run trace.
    process.stderr.write("[agent] confirmation denied because stdin is not interactive\n");
    return false;
  }

  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const prompt = request.tool === "skill_packs" ? "Approve all or choose option numbers? (y=all, 1,3=subset, N=none) " : "Approve this action? (y/N) ";
    return parseConfirmationAnswer(await terminal.question(prompt), request);
  } finally {
    terminal.close();
  }
}

/** Formats numbered Skill Pack options when a confirmation request provides them. */
function formatSkillPackSelectionOptions(request: ConfirmationRequired): string[] {
  return readSkillPackSelectionPaths(request).map((path, index) => {
    const label = readSkillPackSelectionLabel(request, path) ?? path;
    return `  ${index + 1}. ${label} (${path})`;
  });
}

/** Parses comma-separated 1-based option numbers into selected Skill Pack paths. */
function parseSkillPackSelectionAnswer(answer: string, request: ConfirmationRequired): string[] {
  const options = readSkillPackSelectionPaths(request);
  if (options.length === 0) {
    return [];
  }

  const normalized = answer.trim();
  if (!/^\d+(?:\s*,\s*\d+)*$/.test(normalized)) {
    return [];
  }

  const selected = new Set<string>();
  for (const value of normalized.split(",")) {
    const index = Number(value.trim());
    if (!Number.isInteger(index) || index < 1 || index > options.length) {
      return [];
    }
    selected.add(options[index - 1]);
  }
  return [...selected];
}

/** Reads Skill Pack option paths from confirmation action metadata. */
function readSkillPackSelectionPaths(request: ConfirmationRequired): string[] {
  if (!Array.isArray(request.action.skillPacks)) {
    return [];
  }
  return request.action.skillPacks.filter((value): value is string => typeof value === "string");
}

/** Reads a human label for a Skill Pack option from preview metadata. */
function readSkillPackSelectionLabel(request: ConfirmationRequired, path: string): string | null {
  if (!request.preview || !Array.isArray(request.preview.skillPacks)) {
    return null;
  }
  const option = request.preview.skillPacks.find(
    (value) => isRecord(value) && value.path === path && typeof value.name === "string"
  );
  return isRecord(option) && typeof option.name === "string" ? option.name : null;
}

/** Checks whether a value can be safely inspected as a record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
