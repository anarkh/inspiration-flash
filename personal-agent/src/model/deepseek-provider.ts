import { createOpenAICompatibleProvider, type FetchLike } from "./openai-compatible-provider.ts";
import type { ModelProvider } from "./provider.ts";

export interface DeepSeekProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: FetchLike;
}

/** Creates the default DeepSeek provider using the shared OpenAI-compatible adapter. */
export function createDeepSeekProvider(options: DeepSeekProviderOptions): ModelProvider {
  // DeepSeek exposes an OpenAI-compatible chat completions API, so the provider
  // keeps DeepSeek-specific defaults here while reusing the generic adapter.
  return createOpenAICompatibleProvider({
    name: "deepseek",
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? "https://api.deepseek.com",
    model: options.model ?? "deepseek-v4-flash",
    fetch: options.fetch
  });
}
