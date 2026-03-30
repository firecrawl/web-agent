// ─── Firecrawl Agent Configuration ───
// Central config for all model selections and agent behavior.
// Edit this file to change which models power the orchestrator,
// sub-agents, and background tasks.

import type { ModelConfig } from "./lib/types";

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
  background:   { provider: "google", model: "gemini-2.5-flash" } satisfies ModelRef,

  // ═══════════════════════════════════════════
  // OpenAI (GPT)
  // ═══════════════════════════════════════════
  // orchestrator: { provider: "openai", model: "gpt-4.1" } satisfies ModelRef,
  // subAgent:     { provider: "openai", model: "gpt-4.1" } satisfies ModelRef,
  // background:   { provider: "openai", model: "o4-mini" } satisfies ModelRef,

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

export function getTaskModel(task: keyof typeof config.tasks): ModelRef {
  return config.tasks[task] ?? config.background;
}
