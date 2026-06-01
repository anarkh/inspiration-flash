export type KnownAgentErrorKind = "rate_limit" | "auth";

export interface KnownAgentError {
  kind: KnownAgentErrorKind;
  pattern: RegExp;
  title(agent: string): string;
  summary(agent: string): string;
  suggestedPrompt: string;
}

const KNOWN_AGENT_ERRORS: KnownAgentError[] = [{
  kind: "rate_limit",
  pattern: /ProviderRetryPolicyExhaustedError|rate_limit_reached|429 Gateway|throughput limit/i,
  title: (agent) => `${agent} provider rate limit`,
  summary: (agent) => `${agent} provider rate limit; the consumer CLI returned a 429 instead of a JSON verdict.`,
  suggestedPrompt: "Retry the bridge run after the consumer agent provider rate limit clears, or switch the route to another available consumer agent."
}, {
  kind: "auth",
  pattern: /not\s+(?:logged|signed)\s+in|login required|authentication required|not authenticated|please\s+(?:log|sign)\s+in|missing (?:api key|credentials)|invalid api key|unauthorized request/i,
  title: (agent) => `${agent} authentication unavailable`,
  summary: (agent) => `${agent} authentication is unavailable in the hook environment, so the consumer CLI could not produce a JSON verdict.`,
  suggestedPrompt: "Open the Agent Bridge dashboard terminal for this run, verify the consumer CLI login in that environment, then retry the bridge run."
}];

export function detectKnownAgentError(text: string): KnownAgentError | null {
  if (!text.trim()) {
    return null;
  }
  return KNOWN_AGENT_ERRORS.find((error) => error.pattern.test(text)) ?? null;
}

export function firstKnownAgentErrorLine(text: string, error: KnownAgentError): string | null {
  return text.split(/\n/).map((line) => line.trim()).find((line) => error.pattern.test(line)) ?? null;
}
