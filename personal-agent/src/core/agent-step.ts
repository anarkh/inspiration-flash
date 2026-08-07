export type AgentStep =
  | { type: "message"; content: string }
  | { type: "plan"; summary: string; steps: string[] }
  | { type: "tool"; tool: string; input: unknown }
  | { type: "confirm"; prompt: string; action: unknown }
  | { type: "reflect"; note: string; section?: string }
  | { type: "finish"; report: string };

// Agent Steps are the provider-neutral action language for the loop. Keeping
// this whitelist local prevents provider-native tool formats from leaking into
// the core runner.
const stepTypes = new Set(["message", "plan", "tool", "confirm", "reflect", "finish"]);

/** Validates unknown model output and converts it into a provider-neutral Agent Step. */
export function parseAgentStep(value: unknown): AgentStep {
  if (!isRecord(value)) {
    throw new Error("Agent Step must be an object");
  }

  const type = value.type;
  if (typeof type !== "string" || !stepTypes.has(type)) {
    throw new Error(`Unknown Agent Step type: ${String(type)}`);
  }

  if (type === "message") {
    requireString(value.content, "content");
    return { type, content: value.content };
  }

  if (type === "plan") {
    requireString(value.summary, "summary");
    if (!Array.isArray(value.steps) || !value.steps.every((step) => typeof step === "string")) {
      throw new Error("Agent Step plan.steps must be a string array");
    }
    return { type, summary: value.summary, steps: value.steps };
  }

  if (type === "tool") {
    requireString(value.tool, "tool");
    // Tool input remains `unknown` until the typed Tool Registry validates the
    // selected definition's schema, keeping Agent Steps provider-neutral.
    return { type, tool: value.tool, input: value.input ?? null };
  }

  if (type === "confirm") {
    requireString(value.prompt, "prompt");
    return { type, prompt: value.prompt, action: value.action ?? null };
  }

  if (type === "reflect") {
    requireString(value.note, "note");
    if ("section" in value && value.section !== undefined) {
      requireString(value.section, "section");
      return { type, note: value.note, section: value.section };
    }
    return { type, note: value.note };
  }

  if (type === "finish") {
    requireString(value.report, "report");
    return { type, report: value.report };
  }

  throw new Error(`Unknown Agent Step type: ${String(type)}`);
}

/** Checks whether a value is a plain record that can be inspected safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Asserts that a required Agent Step field is a non-empty string. */
function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Agent Step ${field} must be a non-empty string`);
  }
}
