import type { ModelConfig } from "./types";

/**
 * Resolve a ModelConfig to an AI SDK LanguageModel instance.
 * API keys can come from the config itself or the apiKeys map.
 * The consuming app is responsible for sourcing keys (env vars, user input, etc).
 */
export async function resolveModel(
  config: ModelConfig,
  apiKeys?: Record<string, string>,
) {
  const keyFor = (provider: string) =>
    config.apiKey || apiKeys?.[provider] || undefined;

  switch (config.provider) {
    case "gateway": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        apiKey: keyFor("gateway"),
        baseURL: "https://ai-gateway.vercel.sh/v1",
      });
      return provider.chat(config.model);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey: keyFor("anthropic") })(config.model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey: keyFor("openai") })(config.model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey: keyFor("google") })(config.model);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
