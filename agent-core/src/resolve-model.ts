import { initChatModel } from "langchain/chat_models/universal";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelConfig } from "./types";

/**
 * Resolve a ModelConfig to a LangChain chat model via initChatModel — the
 * universal provider factory. No switch case, no per-provider imports.
 *
 * Accepts either:
 *   - a plain string like "anthropic:claude-sonnet-4-6" or "openai:gpt-5.4"
 *   - a ModelConfig with { provider, model, apiKey?, baseURL? }
 *
 * To support providers natively, initChatModel recognizes: anthropic, openai,
 * google-genai, azure-openai, cohere, bedrock, ollama, openrouter, fireworks,
 * groq, mistralai, xai, together, and more. Provider packages must be installed.
 */
export async function resolveModel(
  config: ModelConfig | string,
  apiKeys?: Record<string, string>,
): Promise<BaseChatModel> {
  if (typeof config === "string") {
    return (await initChatModel(config)) as BaseChatModel;
  }

  const modelName = config.provider ? `${config.provider}:${config.model}` : config.model;
  const opts: Record<string, unknown> = {};
  if (config.apiKey || apiKeys?.[config.provider]) {
    opts.apiKey = config.apiKey ?? apiKeys?.[config.provider];
  }
  if (config.baseURL) {
    opts.configuration = { baseURL: config.baseURL };
  }

  return (await initChatModel(modelName, opts)) as BaseChatModel;
}
