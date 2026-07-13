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
  PERSONAL_AGENT_DEBUG_RECOVERY?: string;
}

/** Chooses the best available Model Provider from environment configuration. */
export function createConfiguredProvider(env: ProviderEnvironment = process.env): ModelProvider {
  const provider = createBaseProvider(env);
  if (env.PERSONAL_AGENT_DEBUG_RECOVERY === "1") {
    return createDebugRecoveryProvider(provider);
  }
  return provider;
}

/** Chooses the real provider before optional development-only wrappers are applied. */
function createBaseProvider(env: ProviderEnvironment): ModelProvider {
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

/** Wraps a provider so CLI users can manually observe one Agent Step recovery attempt. */
function createDebugRecoveryProvider(provider: ModelProvider): ModelProvider {
  let injected = false;
  return {
    name: `${provider.name}+debug-recovery`,
    model: provider.model,
    /** Emits one malformed plan, then delegates all later turns to the wrapped provider. */
    async nextStep(input) {
      if (!injected) {
        injected = true;
        // The missing `steps` array intentionally violates the Agent Step schema
        // and lets the runner demonstrate its recovery event path on demand.
        return { type: "plan", summary: "Debug recovery probe without steps." };
      }
      return provider.nextStep(input);
    }
  };
}
