import { createBootstrapProvider } from "./bootstrap-provider.ts";
import { createDeepSeekProvider } from "./deepseek-provider.ts";
import { createOpenAICompatibleProvider } from "./openai-compatible-provider.ts";
import type { ModelProvider } from "./provider.ts";

export interface ProviderEnvironment {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
}

/** Chooses the best available Model Provider from environment configuration. */
export function createConfiguredProvider(env: ProviderEnvironment = process.env): ModelProvider {
  if (env.DEEPSEEK_API_KEY) {
    return createDeepSeekProvider({
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL,
      model: env.DEEPSEEK_MODEL
    });
  }

  // Keep the CLI usable without network credentials; real model calls become an
  // opt-in path once the Owner supplies an API key.
  if (!env.OPENAI_API_KEY) {
    return createBootstrapProvider();
  }

  return createOpenAICompatibleProvider({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL
  });
}
