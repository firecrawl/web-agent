import type { ModelConfig } from "../types";

export async function resolveModel(config: ModelConfig) {
  switch (config.provider) {
    case "gateway": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        apiKey: config.apiKey || process.env.AI_GATEWAY_API_KEY,
        baseURL: "https://ai-gateway.vercel.sh/v1",
      });
      return provider.chat(config.model);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      })(config.model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      })(config.model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({
        apiKey: config.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })(config.model);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

export const AVAILABLE_MODELS = {
  gateway: [
    { id: "openai/gpt-5.4", name: "GPT-5.4", icon: "openai" },
    { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", icon: "claude" },
    { id: "anthropic/claude-opus-4-20250514", name: "Claude Opus 4", icon: "claude" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "gemini" },
    { id: "openai/gpt-4o", name: "GPT-4o", icon: "openai" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", icon: "claude" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", icon: "claude" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", icon: "claude" },
  ],
  openai: [
    { id: "gpt-5.4", name: "GPT-5.4", icon: "openai" },
    { id: "gpt-4.1", name: "GPT-4.1", icon: "openai" },
    { id: "o3", name: "o3", icon: "openai" },
    { id: "o4-mini", name: "o4-mini", icon: "openai" },
  ],
  google: [
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", icon: "gemini" },
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", icon: "gemini" },
  ],
} as const;

export type Provider = keyof typeof AVAILABLE_MODELS;

export const PROVIDER_META: Record<Provider, { name: string; icon: string }> = {
  gateway: { name: "AI Gateway", icon: "vercel" },
  anthropic: { name: "Anthropic", icon: "anthropic" },
  openai: { name: "OpenAI", icon: "openai" },
  google: { name: "Google", icon: "google" },
};
