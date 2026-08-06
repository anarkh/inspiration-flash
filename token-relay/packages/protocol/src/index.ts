export const TOKEN_RELAY_PROTOCOL_VERSION = 1 as const;

export type ChatRole = "system" | "developer" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated?: boolean;
}

export interface RelayJob {
  id: string;
  leaseToken: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  createdAt: string;
  deadlineAt: string;
}

export type RelayPromptInput = Pick<
  RelayJob,
  "model" | "messages" | "maxOutputTokens"
>;

export interface ProviderResult {
  content: string;
  finishReason: "stop" | "length";
  usage: TokenUsage;
}

export interface ProviderFailure {
  code: string;
  message: string;
  retryable: boolean;
  usage?: TokenUsage;
}

export type ProviderClientMessage =
  | {
      type: "hello";
      protocolVersion: typeof TOKEN_RELAY_PROTOCOL_VERSION;
      sdkVersion: string;
      models: string[];
      concurrency: number;
    }
  | {
      type: "heartbeat";
      models: string[];
      concurrency: number;
    }
  | {
      type: "result";
      jobId: string;
      leaseToken: string;
      result: ProviderResult;
    }
  | {
      type: "failure";
      jobId: string;
      leaseToken: string;
      error: ProviderFailure;
    };

export type RelayServerMessage =
  | {
      type: "ready";
      protocolVersion: typeof TOKEN_RELAY_PROTOCOL_VERSION;
      providerId: string;
      heartbeatIntervalMs: number;
    }
  | {
      type: "job";
      job: RelayJob;
    }
  | {
      type: "cancel";
      jobId: string;
      reason: string;
    }
  | {
      type: "ack";
      jobId: string;
    }
  | {
      type: "error";
      code: string;
      message: string;
      jobId?: string;
    };

export interface OpenAiChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  stream?: false;
  user?: string;
}

export interface OpenAiChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: 0;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: ProviderResult["finishReason"];
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AnthropicTextBlock {
  type: "text";
  text: string;
  cache_control?: unknown;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicTextBlock[];
}

export interface AnthropicMessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string | AnthropicTextBlock[];
  temperature?: number;
  stream?: boolean;
  metadata?: unknown;
  output_config?: unknown;
  thinking?: unknown;
  tools?: unknown[];
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicMessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicTextBlock[];
  stop_reason: "end_turn" | "max_tokens";
  stop_sequence: null;
  usage: AnthropicUsage;
}

export type AnthropicMessagesStreamEvent =
  | {
      type: "message_start";
      message: Omit<
        AnthropicMessagesResponse,
        "content" | "stop_reason" | "usage"
      > & {
        content: [];
        stop_reason: null;
        usage: AnthropicUsage;
      };
    }
  | {
      type: "content_block_start";
      index: 0;
      content_block: AnthropicTextBlock;
    }
  | {
      type: "content_block_delta";
      index: 0;
      delta: {
        type: "text_delta";
        text: string;
      };
    }
  | {
      type: "content_block_stop";
      index: 0;
    }
  | {
      type: "message_delta";
      delta: {
        stop_reason: AnthropicMessagesResponse["stop_reason"];
        stop_sequence: null;
      };
      usage: Pick<AnthropicUsage, "output_tokens">;
    }
  | {
      type: "message_stop";
    };

export function estimateTextTokens(text: string): number {
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const character of text) {
    if (character.codePointAt(0)! <= 0x7f) {
      asciiCharacters += 1;
    } else {
      nonAsciiCharacters += 1;
    }
  }
  return Math.max(1, Math.ceil(asciiCharacters / 4) + nonAsciiCharacters);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  const contentTokens = messages.reduce(
    (total, message) => total + estimateTextTokens(message.content),
    0
  );
  return contentTokens + messages.length * 4 + 2;
}

export function buildRelayPrompt(job: RelayPromptInput): string {
  return [
    "You are answering a chat request through Token Relay.",
    "Follow the system and developer messages, then answer the latest user request.",
    "Return only the assistant response in plain text. Do not include transport metadata.",
    `The requested model is ${JSON.stringify(job.model)} and the response limit is approximately ${job.maxOutputTokens} tokens.`,
    "",
    "<conversation>",
    ...job.messages.flatMap((message) => [
      `<message role="${message.role}">`,
      escapeXml(message.content),
      "</message>"
    ]),
    "</conversation>"
  ].join("\n");
}

export function estimateRelayPromptTokens(job: RelayPromptInput): number {
  return estimateTextTokens(buildRelayPrompt(job));
}

export function normalizeUsage(
  usage: Partial<TokenUsage> | undefined,
  promptFallback: number,
  completionFallback: number
): TokenUsage {
  const reportedPrompt = nonNegativeInteger(usage?.promptTokens);
  const reportedCompletion = nonNegativeInteger(usage?.completionTokens);
  const reportedTotal = nonNegativeInteger(usage?.totalTokens);
  const promptTokens = reportedPrompt ?? promptFallback;
  const completionTokens = reportedCompletion ?? completionFallback;
  return {
    promptTokens,
    completionTokens,
    totalTokens: Math.max(reportedTotal ?? 0, promptTokens + completionTokens),
    estimated: usage?.estimated
      ?? (reportedPrompt === null || reportedCompletion === null)
  };
}

export function isProviderClientMessage(value: unknown): value is ProviderClientMessage {
  if (!isObject(value) || typeof value.type !== "string") {
    return false;
  }
  switch (value.type) {
    case "hello":
      return value.protocolVersion === TOKEN_RELAY_PROTOCOL_VERSION
        && typeof value.sdkVersion === "string"
        && isStringArray(value.models)
        && positiveInteger(value.concurrency) !== null;
    case "heartbeat":
      return isStringArray(value.models) && positiveInteger(value.concurrency) !== null;
    case "result":
      return nonEmptyString(value.jobId)
        && nonEmptyString(value.leaseToken)
        && isProviderResult(value.result);
    case "failure":
      return nonEmptyString(value.jobId)
        && nonEmptyString(value.leaseToken)
        && isProviderFailure(value.error);
    default:
      return false;
  }
}

export function isRelayServerMessage(value: unknown): value is RelayServerMessage {
  if (!isObject(value) || typeof value.type !== "string") {
    return false;
  }
  switch (value.type) {
    case "ready":
      return value.protocolVersion === TOKEN_RELAY_PROTOCOL_VERSION
        && nonEmptyString(value.providerId)
        && positiveInteger(value.heartbeatIntervalMs) !== null;
    case "job":
      return isRelayJob(value.job);
    case "cancel":
      return nonEmptyString(value.jobId) && nonEmptyString(value.reason);
    case "ack":
      return nonEmptyString(value.jobId);
    case "error":
      return nonEmptyString(value.code)
        && nonEmptyString(value.message)
        && (value.jobId === undefined || nonEmptyString(value.jobId));
    default:
      return false;
  }
}

function isRelayJob(value: unknown): value is RelayJob {
  return isObject(value)
    && nonEmptyString(value.id)
    && nonEmptyString(value.leaseToken)
    && nonEmptyString(value.model)
    && Array.isArray(value.messages)
    && value.messages.every(isChatMessage)
    && positiveInteger(value.maxOutputTokens) !== null
    && nonEmptyString(value.createdAt)
    && nonEmptyString(value.deadlineAt);
}

function isProviderResult(value: unknown): value is ProviderResult {
  return isObject(value)
    && typeof value.content === "string"
    && (value.finishReason === "stop" || value.finishReason === "length")
    && isUsage(value.usage);
}

function isProviderFailure(value: unknown): value is ProviderFailure {
  return isObject(value)
    && nonEmptyString(value.code)
    && nonEmptyString(value.message)
    && typeof value.retryable === "boolean"
    && (value.usage === undefined || isUsage(value.usage));
}

function isUsage(value: unknown): value is TokenUsage {
  return isObject(value)
    && nonNegativeInteger(value.promptTokens) !== null
    && nonNegativeInteger(value.completionTokens) !== null
    && nonNegativeInteger(value.totalTokens) !== null;
}

function isChatMessage(value: unknown): value is ChatMessage {
  return isObject(value)
    && (value.role === "system"
      || value.role === "developer"
      || value.role === "user"
      || value.role === "assistant")
    && typeof value.content === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every(nonEmptyString);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}
