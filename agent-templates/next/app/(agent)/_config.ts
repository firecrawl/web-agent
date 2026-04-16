// ─── Firecrawl Agent Configuration ───
// Central config for all model selections and agent behavior.
// Edit this file to change which models power the orchestrator,
// sub-agents, and background tasks.

import type { ModelConfig } from "@/agent-core";

type ModelRef = Pick<ModelConfig, "provider" | "model" | "baseURL">;

export const config = {

  // ═══════════════════════════════════════════
  // Anthropic (Claude)
  // ═══════════════════════════════════════════
  orchestrator: { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies ModelRef,
  subAgent:     { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies ModelRef,
  background:   { provider: "anthropic", model: "claude-haiku-4-5-20251001" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // Google (Gemini)
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "google", model: "gemini-3.1-pro-preview" } satisfies ModelRef,
  // subAgent:     { provider: "google", model: "gemini-3-flash-preview" } satisfies ModelRef,
  // background:   { provider: "google", model: "gemini-3.1-flash-lite-preview" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // OpenAI (GPT)
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "openai", model: "gpt-5.4" } satisfies ModelRef,
  // subAgent:     { provider: "openai", model: "gpt-5.4" } satisfies ModelRef,
  // background:   { provider: "openai", model: "o4-mini" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // Custom OpenAI-compatible
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "custom-openai", model: "gpt-4.1", baseURL: "https://openrouter.ai/api/v1" } satisfies ModelRef,
  // subAgent:     { provider: "custom-openai", model: "gpt-4.1", baseURL: "https://openrouter.ai/api/v1" } satisfies ModelRef,
  // background:   { provider: "custom-openai", model: "gpt-4.1", baseURL: "https://openrouter.ai/api/v1" } satisfies ModelRef,

  // ─── Parallel workers ───
  maxWorkers: 10,              // Max concurrent worker agents
  workerMaxSteps: 50,          // Max steps per worker — let them finish complex tasks

  // ─── Task-specific overrides ───
  // Set a model here to override the background model for that task.
  // null = use the background model above.
  tasks: {
    plan: null as ModelRef | null,             // Execution plan generation
    suggestions: null as ModelRef | null,       // Follow-up suggestion generation
    skillGeneration: null as ModelRef | null,   // SKILL.md generation from transcripts
    query: null as ModelRef | null,            // /api/query endpoint default
    extract: null as ModelRef | null,          // /api/extract endpoint default
  },

  // ─── Experimental features ───
  experimental: {
    customOpenAI: true,     // Expose a configurable OpenAI-compatible provider in Settings
    generateSkillMd: true,  // Show the SKILL.md generator UI + route
    // ACP (Agent Communication Protocol) support is still experimental.
    // Set to true to enable local agent discovery and routing via ACP.
    acp: false,
  },

  // ─── Conversation history ───
  history: {
    enabled: false, // When false, disables SQLite-backed conversation history and hides history UI
  },
};

// ─── Resolved helpers ───

export function getOrchestratorModel(): ModelRef {
  return config.orchestrator;
}

export function getSubAgentModel(): ModelRef {
  return config.subAgent;
}

export function getBackgroundModel(): ModelRef {
  return config.background;
}

// Pricing per 1M tokens (input / output) — approximate
// Pricing per 1M tokens (input / output) — approximate, USD
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-opus-4-7": { input: 15, output: 75 },
  "gpt-5.4": { input: 2, output: 8 },
  "gpt-4.1": { input: 2, output: 8 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "gemini-3.1-pro-preview": { input: 1.25, output: 10 },
  "gemini-3-flash-preview": { input: 0.15, output: 0.6 },
  "gemini-3.1-flash-lite-preview": { input: 0.04, output: 0.15 },
};

export function estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
  const m = model ?? config.orchestrator.model;
  const pricing = MODEL_PRICING[m] ?? { input: 1, output: 4 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function getTaskModel(task: keyof typeof config.tasks): ModelRef {
  return config.tasks[task] ?? config.background;
}

export function getExperimentalFeatures() {
  return config.experimental;
}

export function getHistoryConfig() {
  return config.history;
}
