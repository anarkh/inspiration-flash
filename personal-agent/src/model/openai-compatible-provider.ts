import { parseAgentStep, type AgentStep } from "../core/agent-step.ts";
import { formatLocalToolCatalogForPrompt } from "../tools/local-tools.ts";
import type { ModelProvider, ModelProviderInput } from "./provider.ts";

interface FetchResponse {
  ok: boolean;
  status: number;
  /** Reads the raw HTTP response body returned by the model provider. */
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponse>;

export interface OpenAICompatibleProviderOptions {
  name?: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: FetchLike;
}

/** Creates a Model Provider backed by an OpenAI-compatible chat completions API. */
export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): ModelProvider {
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = options.model ?? "gpt-4.1-mini";
  // Fetch is injectable so tests can verify request shape without making
  // network calls, while production can use Node's global fetch.
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("OpenAI-compatible provider requires fetch");
  }

  return {
    name: options.name ?? "openai-compatible",
    model,
    /** Sends the current agent loop state to the model and returns one Agent Step. */
    async nextStep(input) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: createSystemPrompt(input)
            },
            {
              role: "user",
              content: JSON.stringify(toPromptPayload(input))
            }
          ],
          // JSON mode is requested when supported, but the core loop still
          // validates the returned Agent Step before executing it.
          response_format: { type: "json_object" }
        })
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAI-compatible provider failed with ${response.status}: ${body}`);
      }

      return parseChatCompletionStep(body);
    }
  };
}

/** Builds interaction-specific instructions while preserving one provider-neutral step schema. */
function createSystemPrompt(input: ModelProviderInput): string {
  const interactionInstructions =
    input.interaction === "chat"
      ? [
          "This is an ongoing interactive chat.",
          "Answer the latest owner_message and use earlier owner_message and message events as conversation history.",
          "For a direct conversational answer, return message {type,content}.",
          "You may use plan, tool, confirm, or reflect before replying when work is required.",
          "Never return finish in chat interaction; the runtime finalizes the chat after the Owner exits or input closes."
        ]
      : [
          "This is a task interaction that must eventually return finish {type,report}.",
          "Allowed types: message, plan, tool, confirm, reflect, finish."
        ];

  return [
    "You are the model inside a Personal Agent.",
    "Return exactly one JSON object representing the next provider-neutral Agent Step.",
    ...interactionInstructions,
    "Schemas: message {type,content}; plan {type,summary,steps}; tool {type,tool,input}; confirm {type,prompt,action}; reflect {type,note,section?}; finish {type,report}.",
    "Events may include owner_message entries for visible user turns in chat mode.",
    "Use reflect with section stable-facts, preferences, project-conventions, or open-threads when you have a candidate Project Memory note; reflect does not save memory by itself.",
    `Available local tools and input schemas: ${formatLocalToolCatalogForPrompt()}.`,
    "write_file and workspace-writing commands may return confirmation_required instead of changing files immediately.",
    "Do not wrap the JSON in markdown."
  ].join(" ");
}

/** Builds the JSON payload that teaches the model about the current Task Run state. */
function toPromptPayload(input: ModelProviderInput): Record<string, unknown> {
  return {
    goal: input.goal,
    mode: input.mode,
    interaction: input.interaction,
    successCheck: input.successCheck,
    turn: input.turn,
    events: input.events,
    projectMemory: input.projectMemory ?? "",
    skillPacks: input.skillPacks ?? ""
  };
}

/** Parses a chat completion response body into the project-owned Agent Step schema. */
function parseChatCompletionStep(body: string): AgentStep {
  // Keep provider-native response parsing here so the runner only sees the
  // provider-neutral Agent Step shape.
  const parsed = JSON.parse(body) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI-compatible provider returned no message content");
  }
  return parseAgentStep(normalizeAgentStepCandidate(JSON.parse(content)));
}

/** Normalizes common provider-native JSON variants before Agent Step validation. */
function normalizeAgentStepCandidate(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (value.type === "plan" && typeof value.summary !== "string") {
    const summary = summarizePlanFields(value);
    if (summary) {
      // Some models infer `title`/`description` for plans even when JSON mode is
      // enabled. Normalize that provider-native shape at the adapter boundary so
      // the runner only receives the project-owned Agent Step schema.
      return { type: "plan", summary, steps: value.steps };
    }
  }

  return value;
}

/** Creates a plan summary from model fields that are close to, but not exactly, our schema. */
function summarizePlanFields(value: Record<string, unknown>): string | null {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";

  if (title && description) {
    return `${title}: ${description}`;
  }
  return title || description || null;
}

/** Checks whether a value is a plain record that can be inspected safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
