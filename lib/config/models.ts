import type { ModelConfig } from "../types";

export async function resolveModel(config: ModelConfig) {
  switch (config.provider) {
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
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-haiku-4-20250414", name: "Claude Haiku 4" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  ],
  google: [
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro" },
  ],
} as const;

export type Provider = keyof typeof AVAILABLE_MODELS;
