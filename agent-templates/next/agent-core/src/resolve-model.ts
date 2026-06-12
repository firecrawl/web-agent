import type { LanguageModel } from "ai";
import type { ModelConfig } from "./types";

/** Placeholder API key for keyless local Atomic Chat (OpenAI client requires a string). */
export const ATOMIC_CHAT_DEFAULT_API_KEY = "atomic-chat-local";
export const ATOMIC_CHAT_DEFAULT_BASE_URL = "http://127.0.0.1:1337/v1";

/**
 * Resolve a ModelConfig to an AI SDK LanguageModel instance.
 * API keys can come from the config itself or the apiKeys map.
 * The consuming app is responsible for sourcing keys (env vars, user input, etc).
 */
export async function resolveModel(
  config: ModelConfig,
  apiKeys?: Record<string, string>,
): Promise<LanguageModel> {
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
    case "custom-openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const baseURL = config.baseURL || apiKeys?.["custom-openai:baseURL"];
      if (!baseURL) {
        throw new Error("CUSTOM_OPENAI_BASE_URL is not configured for the custom-openai provider");
      }
      return createOpenAI({
        apiKey: keyFor("custom-openai"),
        baseURL,
      })(config.model);
    }
    case "atomic-chat": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const baseURL = config.baseURL || apiKeys?.["atomic-chat:baseURL"] || ATOMIC_CHAT_DEFAULT_BASE_URL;
      return createOpenAI({
        apiKey: keyFor("atomic-chat") || ATOMIC_CHAT_DEFAULT_API_KEY,
        baseURL,
      })(config.model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey: keyFor("google") })(config.model);
    }
    default: {
      // Catch the common "forgot the provider prefix" mistake.
      // If the "provider" looks like a model ID (contains a hyphen or dot),
      // the user probably set MODEL=my-model instead of MODEL=provider:my-model.
      const looksLikeModelId = /[-.]/.test(config.provider);
      const hint = looksLikeModelId
        ? `. Did you mean MODEL="anthropic:${config.provider}" or similar? Format is "provider:model-id"`
        : `. Supported: anthropic, openai, google, gateway, custom-openai, atomic-chat`;
      throw new Error(`Unsupported provider: "${config.provider}"${hint}`);
    }
  }
}
