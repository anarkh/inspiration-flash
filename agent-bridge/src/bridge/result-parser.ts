import type { BridgeFinding, BridgeOutputMode, BridgeResult, BridgeVerdict } from "../core/types.ts";
import { detectKnownAgentError, firstKnownAgentErrorLine } from "../core/agent-errors.ts";

export interface BridgeOutputParseOptions {
  mode?: BridgeOutputMode;
}

interface CliResultEnvelope {
  text: string;
  isError: boolean;
  subtype?: string;
  errors: string[];
}

export function parseBridgeOutput(output: string, agent: string, options: BridgeOutputParseOptions = {}): BridgeResult {
  const rawText = stripAnsi(output).trim();
  const text = extractTextFromCliOutput(output).trim();
  if (options.mode === "chat") {
    const envelope = extractCliResultEnvelope(rawText);
    if (envelope) {
      return envelope.isError
        ? cliEnvelopeErrorResult(envelope, agent, rawText)
        : chatOutputResult(envelope.text.trim(), agent, rawText);
    }
    return chatOutputResult(text, agent, rawText);
  }
  const parsed = tryParseJsonObject(text);
  if (parsed) {
    return normalizeParsedResult(parsed, agent, text);
  }
  const knownError = knownErrorResult(text, agent);
  if (knownError) {
    return knownError;
  }
  return {
    verdict: "uncertain",
    summary: "Agent did not return parseable JSON.",
    findings: [{
      severity: "info",
      title: "Unstructured agent output",
      detail: text.slice(0, 4000)
    }],
    suggestedPrompt: "Inspect the unstructured agent output and decide whether another producer pass is needed.",
    agent,
    rawOutput: text
  };
}

function cliEnvelopeErrorResult(envelope: CliResultEnvelope, agent: string, rawOutput: string): BridgeResult {
  const maxTurns = envelope.subtype === "error_max_turns";
  const detail = envelope.errors.join("\n") || envelope.text || envelope.subtype || "Consumer CLI returned an error result.";
  return {
    verdict: "uncertain",
    summary: maxTurns
      ? `${agent} reached its maximum turn limit before producing an answer.`
      : `${agent} returned an error result instead of an answer.`,
    findings: [{
      severity: "info",
      title: maxTurns ? `${agent} maximum turns reached` : `${agent} CLI error`,
      detail
    }],
    suggestedPrompt: maxTurns
      ? "Retry with fewer tool steps or increase the configured Claude maximum turns."
      : "Inspect the consumer CLI error and retry the direct message.",
    agent,
    rawOutput
  };
}

function chatOutputResult(text: string, agent: string, rawOutput = text): BridgeResult {
  if (!text) {
    return {
      verdict: "uncertain",
      summary: "Agent returned empty output.",
      findings: [{
        severity: "info",
        title: "Empty agent output"
      }],
      suggestedPrompt: "Retry the direct chat message or inspect the consumer CLI logs.",
      agent,
      rawOutput
    };
  }
  return {
    verdict: "pass",
    summary: truncateSummary(text),
    findings: [],
    suggestedPrompt: "",
    agent,
    rawOutput
  };
}

function truncateSummary(text: string): string {
  return text.length <= 4000 ? text : `${text.slice(0, 3997)}...`;
}

function knownErrorResult(text: string, agent: string): BridgeResult | null {
  const knownError = detectKnownAgentError(text);
  if (!knownError) {
    return null;
  }
  return {
    verdict: "uncertain",
    summary: knownError.summary(agent),
    findings: [{
      severity: "info",
      title: knownError.title(agent),
      detail: firstKnownAgentErrorLine(text, knownError) ?? text.slice(0, 1000)
    }],
    suggestedPrompt: knownError.suggestedPrompt,
    agent,
    rawOutput: text
  };
}

export function extractTextFromCliOutput(output: string): string {
  const trimmed = stripAnsi(output).trim();
  if (!trimmed) {
    return "";
  }
  const parsed = tryJson(trimmed);
  if (parsed !== null) {
    return extractText(parsed);
  }
  return trimmed;
}

function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "");
}

function normalizeParsedResult(value: Record<string, unknown>, agent: string, rawOutput: string): BridgeResult {
  const verdict = normalizeVerdict(value.verdict);
  const summary = typeof value.summary === "string" && value.summary.trim()
    ? value.summary.trim()
    : "Agent returned no summary.";
  const suggestedPrompt = typeof value.suggestedPrompt === "string"
    ? value.suggestedPrompt
    : typeof value.suggested_prompt === "string"
      ? value.suggested_prompt
      : "";
  const findings = normalizeFindings(value.findings);
  return {
    verdict,
    summary,
    findings,
    suggestedPrompt,
    agent,
    rawOutput
  };
}

function normalizeVerdict(value: unknown): BridgeVerdict {
  return value === "pass" || value === "fail" || value === "uncertain" ? value : "uncertain";
}

function normalizeFindings(value: unknown): BridgeFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (typeof item === "string") {
      return { title: item };
    }
    if (typeof item === "object" && item !== null) {
      const record = item as Record<string, unknown>;
      return {
        severity: normalizeSeverity(record.severity),
        title: typeof record.title === "string" ? record.title : "Finding",
        detail: typeof record.detail === "string" ? record.detail : undefined,
        file: typeof record.file === "string" ? record.file : undefined,
        line: typeof record.line === "number" ? record.line : undefined
      };
    }
    return { title: String(item) };
  });
}

function normalizeSeverity(value: unknown): BridgeFinding["severity"] {
  if (value === "critical" || value === "high" || value === "medium" || value === "low" || value === "info") {
    return value;
  }
  return undefined;
}

export function hasBridgeResultJson(output: string): boolean {
  const text = extractTextFromCliOutput(output).trim();
  return tryParseJsonObject(text) !== null;
}

export function hasSuccessfulCliOutput(output: string): boolean {
  if (hasBridgeResultJson(output)) {
    return true;
  }
  const envelope = extractCliResultEnvelope(stripAnsi(output).trim());
  return envelope !== null && !envelope.isError;
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const candidates = [
    text,
    fencedJson(text)
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    const parsed = tryJson(candidate) ?? tryJson(repairTerminalWrappedJson(candidate));
    const result = bridgeResultObject(parsed);
    if (result) {
      return result;
    }
  }
  for (const candidate of jsonObjectCandidatesFromEnd(text)) {
    const parsed = tryJson(candidate) ?? tryJson(repairTerminalWrappedJson(candidate));
    const result = bridgeResultObject(parsed);
    if (result) {
      return result;
    }
  }
  return null;
}

function tryJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function repairTerminalWrappedJson(text: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString && char === "\n") {
      repaired += " ";
      while (text[index + 1] === " " || text[index + 1] === "\t") {
        index += 1;
      }
      continue;
    }

    repaired += char;

    if (!inString) {
      if (char === "\"") {
        inString = true;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "\"") {
      inString = false;
    }
  }

  return repaired;
}

function fencedJson(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? null;
}

function isBridgeResultObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && ("verdict" in value || "summary" in value || "findings" in value || "suggestedPrompt" in value);
}

function bridgeResultObject(value: unknown): Record<string, unknown> | null {
  if (isBridgeResultObject(value)) {
    return value;
  }
  const embedded = embeddedText(value);
  return embedded ? tryParseJsonObject(embedded) : null;
}

function extractCliResultEnvelope(text: string): CliResultEnvelope | null {
  const candidates = [
    text,
    fencedJson(text)
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    const envelope = cliResultEnvelope(tryJson(candidate) ?? tryJson(repairTerminalWrappedJson(candidate)));
    if (envelope) {
      return envelope;
    }
  }
  for (const candidate of jsonObjectCandidatesFromEnd(text)) {
    const envelope = cliResultEnvelope(tryJson(candidate) ?? tryJson(repairTerminalWrappedJson(candidate)));
    if (envelope) {
      return envelope;
    }
  }
  return null;
}

function cliResultEnvelope(value: unknown): CliResultEnvelope | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.type !== "result") {
    return null;
  }
  const subtype = typeof record.subtype === "string" ? record.subtype : undefined;
  const errors = Array.isArray(record.errors)
    ? record.errors.filter((item): item is string => typeof item === "string")
    : [];
  const text = typeof record.result === "string" ? record.result : "";
  return {
    text,
    isError: record.is_error === true || Boolean(subtype?.startsWith("error_")),
    subtype,
    errors
  };
}

function embeddedText(value: unknown): string | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.result === "string") {
      return record.result;
    }
    if (typeof record.text === "string") {
      return record.text;
    }
    if (typeof record.content === "string") {
      return record.content;
    }
    if (record.message) {
      return extractText(record.message);
    }
  }
  return null;
}

function* jsonObjectCandidatesFromEnd(text: string): Generator<string> {
  let index = text.lastIndexOf("{");
  while (index !== -1) {
    const candidate = balancedJsonObjectFrom(text, index);
    if (candidate) {
      yield candidate;
    }
    index = text.lastIndexOf("{", index - 1);
  }
}

function balancedJsonObjectFrom(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return null;
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n");
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.result === "string") {
      return record.result;
    }
    if (typeof record.text === "string") {
      return record.text;
    }
    if (typeof record.content === "string") {
      return record.content;
    }
    if (Array.isArray(record.content)) {
      return record.content.map(extractText).filter(Boolean).join("\n");
    }
    if (record.message) {
      return extractText(record.message);
    }
  }
  return JSON.stringify(value);
}
