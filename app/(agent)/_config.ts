// ─── Firecrawl Agent Configuration ───
// Central config for all model selections and agent behavior.
// Edit this file to change which models power the orchestrator,
// sub-agents, and background tasks.

import type { ModelConfig } from "@agent-core";

type ModelRef = Pick<ModelConfig, "provider" | "model">;

export const config = {

  // ═══════════════════════════════════════════
  // Anthropic (Claude)
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies ModelRef,
  // subAgent:     { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies ModelRef,
  // background:   { provider: "anthropic", model: "claude-haiku-4-5-20251001" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // Google (Gemini)
  // ═══════════════════════════════════════════
  orchestrator: { provider: "google", model: "gemini-3-flash-preview" } satisfies ModelRef,
  subAgent:     { provider: "google", model: "gemini-3-flash-preview" } satisfies ModelRef,
  background:   { provider: "google", model: "gemini-3-flash-preview" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // OpenAI (GPT)
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "openai", model: "gpt-5.4" } satisfies ModelRef,
  // subAgent:     { provider: "openai", model: "gpt-5.4" } satisfies ModelRef,
  // background:   { provider: "openai", model: "gpt-5.4" } satisfies ModelRef,

  // ─── Parallel workers ───
  maxWorkers: 6,               // Max concurrent worker agents
  workerMaxSteps: 10,          // Max steps per worker

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
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "gpt-5.4": { input: 2, output: 8 },
  "gpt-4.1": { input: 2, output: 8 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "gemini-3-flash-preview": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-pro-preview-05-06": { input: 1.25, output: 10 },
};

export function estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
  const m = model ?? config.orchestrator.model;
  const pricing = MODEL_PRICING[m] ?? { input: 1, output: 4 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function getTaskModel(task: keyof typeof config.tasks): ModelRef {
  return config.tasks[task] ?? config.background;
}
