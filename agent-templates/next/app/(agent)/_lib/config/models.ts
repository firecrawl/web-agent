export const AVAILABLE_MODELS = {
  gateway: [
    { id: "openai/gpt-5.4", name: "GPT-5.4", icon: "openai" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", icon: "claude" },
    { id: "anthropic/claude-opus-4-7", name: "Claude Opus 4.7", icon: "claude" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "gemini" },
    { id: "openai/gpt-4o", name: "GPT-4o", icon: "openai" },
  ],
  anthropic: [
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", icon: "claude" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", icon: "claude" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", icon: "claude" },
  ],
  openai: [
    { id: "gpt-5.4", name: "GPT-5.4", icon: "openai" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 mini", icon: "openai" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 nano", icon: "openai" },
  ],
  "custom-openai": [
    { id: "gpt-5.4", name: "GPT-5.4", icon: "openai" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 mini", icon: "openai" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 nano", icon: "openai" },
  ],
  google: [
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", icon: "gemini" },
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", icon: "gemini" },
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", icon: "gemini" },
  ],
  // Spark 1 models are experimental and not yet available for BYOK.
  // firecrawl: [
  //   { id: "spark-1-mini", name: "Spark 1 Mini", icon: "firecrawl" },
  //   { id: "spark-1-pro", name: "Spark 1 Pro", icon: "firecrawl" },
  // ],
} as Record<string, readonly { id: string; name: string; icon: string }[]>;

export type Provider = keyof typeof AVAILABLE_MODELS;

export const PROVIDER_META: Record<string, { name: string; icon: string }> = {
  gateway: { name: "AI Gateway", icon: "vercel" },
  anthropic: { name: "Anthropic", icon: "anthropic" },
  openai: { name: "OpenAI", icon: "openai" },
  "custom-openai": { name: "Custom OpenAI", icon: "openai" },
  google: { name: "Google", icon: "google" },
};
