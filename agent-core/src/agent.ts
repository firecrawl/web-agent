import { createDeepAgent, type DeepAgent, type SubAgent } from "deepagents";
import path from "path";
import { fileURLToPath } from "url";
import { resolveModel } from "./resolve-model";
import { firecrawlTools, firecrawlSystemPrompt, utilityTools } from "./firecrawl-tools";
import type { CreateFirecrawlAgentOptions } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SKILLS_DIR = path.join(__dirname, "skills", "definitions");

/**
 * Create a Firecrawl-powered Deep Agent with sensible defaults.
 *
 * Returns a raw Deep Agent — you get `.invoke()` and `.stream()` for free.
 * For SSE / Express helpers, import `toResponse` / `toSSE` from the stream
 * helpers. For full custom assembly, use `createDeepAgent` directly along
 * with our exported primitives: `firecrawlTools`, `utilityTools`,
 * `DEFAULT_SKILLS_DIR`.
 *
 * @example
 * ```ts
 * const agent = await createFirecrawlAgent({
 *   firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
 *   model: "anthropic:claude-sonnet-4-6",
 * });
 * const res = await agent.invoke({
 *   messages: [{ role: "user", content: "get vercel pricing" }],
 * });
 * ```
 */
export async function createFirecrawlAgent(opts: CreateFirecrawlAgentOptions): Promise<DeepAgent> {
  const model =
    typeof opts.model === "string"
      ? opts.model
      : await resolveModel(opts.model, opts.apiKeys);

  const fcTools = opts.firecrawlApiKey
    ? firecrawlTools({ apiKey: opts.firecrawlApiKey, ...opts.firecrawlOptions })
    : [];

  const skillsDir = opts.skillsDir ?? DEFAULT_SKILLS_DIR;

  const defaultSystemPrompt = opts.firecrawlApiKey
    ? firecrawlSystemPrompt({ apiKey: opts.firecrawlApiKey, ...opts.firecrawlOptions })
    : undefined;

  const tools = [
    ...fcTools,
    utilityTools.formatOutput,
    utilityTools.bashExec,
    utilityTools.exportSkill(opts.skillsDir),
    ...(opts.tools ?? []),
  ];

  const subagents: SubAgent[] = opts.subagents ?? [];

  return createDeepAgent({
    model: model as any,
    tools,
    subagents,
    skills: [skillsDir, ...(opts.skills ?? [])],
    systemPrompt: opts.systemPrompt ?? defaultSystemPrompt,
  });
}

/**
 * Create a Firecrawl agent configured entirely from environment variables.
 * Reads FIRECRAWL_API_KEY, MODEL (e.g. "anthropic:claude-sonnet-4-6"), and
 * provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.).
 */
export async function createFirecrawlAgentFromEnv(
  overrides?: Partial<CreateFirecrawlAgentOptions>,
): Promise<DeepAgent> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const model = process.env.MODEL ?? "anthropic:claude-sonnet-4-6";

  return createFirecrawlAgent({
    firecrawlApiKey,
    model,
    ...overrides,
  });
}
