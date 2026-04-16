import type { ToolSet } from "ai";

export interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

/**
 * A pre-built toolkit that agent-core uses. The host application constructs
 * this (e.g. from FirecrawlTools) and passes it in — agent-core never imports
 * tool providers directly.
 */
export interface Toolkit {
  /** Tools to attach to the agent (search, scrape, interact, map, etc.) */
  tools: ToolSet;
  /** System prompt snippet from the tool provider (e.g. Firecrawl usage instructions) */
  systemPrompt?: string;
  /**
   * Factory to build a filtered toolset for sub-agents/workers.
   * Called with an optional list of enabled tool names.
   */
  createFiltered?: (enabledTools?: string[]) => ToolSet;
}

export interface ModelConfig {
  provider: "gateway" | "anthropic" | "openai" | "google" | "custom-openai";
  model: string;
  apiKey?: string;
  baseURL?: string;
  bin?: string;
}

export interface SubAgentConfig {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  model: ModelConfig;
  tools: ("search" | "scrape" | "interact" | "map")[];
  skills: string[];
  maxSteps?: number;
}

export interface SitePlaybook {
  name: string;
  platform: string;
  domains: string[];
  filePath: string;
}

export interface SkillMetadata {
  name: string;
  description: string;
  category?: string;
  directory: string;
  resources: string[];
  sitePlaybooks?: SitePlaybook[];
}

export interface AgentConfig {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  columns?: string[];
  uploads?: UploadedFile[];
  model: ModelConfig;
  subAgentModel?: ModelConfig;
  operationModels?: Record<string, ModelConfig>;
  skills: string[];
  skillInstructions?: Record<string, string>;
  subAgents: SubAgentConfig[];
  maxSteps?: number;
  /** When true, the agent is instructed to call exportSkill after completing the task */
  exportSkill?: boolean;
}

// --- Agent Core public API types ---

export interface FirecrawlToolsConfig {
  /** Defaults for search, or false to disable */
  search?: Record<string, unknown> | false;
  /** Defaults for scrape, or false to disable */
  scrape?: Record<string, unknown> | false;
  /** Defaults for interact, or false to disable */
  interact?: Record<string, unknown> | false;
  /** Include map tool */
  map?: boolean;
  /** Include crawl tool */
  crawl?: boolean;
  /** Max approximate tokens for tool responses */
  maxResponseTokens?: number;
  /**
   * When true, replace `scrape` with `scrapeBash` — a single tool that loads
   * pages into a WASM sandbox and queries them with rg/grep/sed. Full page
   * markdown never enters the LLM context, cutting tokens and preventing the
   * "enrichment" failure mode where the model invents extra scrapes.
   */
  bash?: boolean;
  /**
   * Fires when an interact session attaches and a `liveViewUrl` is known.
   * Used by the route handler to push the iframe URL out through the UI
   * stream so the browser tile can render live as actions happen. Each
   * sub-agent spawn gets its own interact instance, so multiple parallel
   * sessions coexist without session-state collisions.
   */
  onInteractSessionStart?: (info: {
    scrapeId: string;
    liveViewUrl: string | null;
    interactiveLiveViewUrl: string | null;
    url: string;
  }) => void | Promise<void>;
  /**
   * When true, interact's `bootstrap()` fires a no-op warmup so `liveViewUrl`
   * is populated before the first real action resolves. Adds ~1-2s to the
   * first `execute` call in exchange for the iframe showing up immediately.
   * Default: `false`.
   */
  interactAutoStart?: boolean;
  /**
   * Hard cap for a single `interact` call. When a session exceeds this, the
   * tool resolves with `{ error, timedOut: true, url, prompt }` instead of
   * hanging. Default: `60_000` (60s). Set to `0` or a negative value to
   * disable.
   */
  interactTimeoutMs?: number;
}

export interface CreateAgentOptions {
  /** Firecrawl API key — used to build the default toolkit */
  firecrawlApiKey: string;
  /** Configure which Firecrawl tools are enabled and their defaults */
  firecrawlOptions?: FirecrawlToolsConfig;
  /** Override the default Firecrawl toolkit with a custom one */
  toolkit?: Toolkit;
  model: ModelConfig;
  subAgentModel?: ModelConfig;
  apiKeys?: Record<string, string>;
  skillsDir?: string;
  promptsDir?: string;
  maxSteps?: number;
  maxWorkers?: number;
  workerMaxSteps?: number;
  /**
   * App-specific prompt sections appended to the base system prompt.
   * Use this to inject UI-specific policies (planning style, presentation mode,
   * workflow examples) without modifying agent-core.
   */
  appSections?: string[];
}

export interface RunParams {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  format?: "json" | "markdown";
  columns?: string[];
  uploads?: UploadedFile[];
  skills?: string[];
  skillInstructions?: Record<string, string>;
  subAgents?: SubAgentConfig[];
  maxSteps?: number;
  /** When true, post-processes the run into a reusable skill (SKILL.md + workflow.mjs + schema.json) */
  exportSkill?: boolean;
  onStep?: (event: StepEvent) => void;
}

export interface StepEvent {
  type: "text" | "tool-call" | "tool-result" | "usage";
  text?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export interface AgentEvent {
  type: "text" | "tool-call" | "tool-result" | "usage" | "done" | "error";
  content?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  text?: string;
  steps?: StepDetail[];
  error?: string;
}

export interface StepDetail {
  text: string;
  toolCalls: { name: string; input: unknown }[];
  toolResults: { name: string; output: unknown }[];
}

export interface ExportedSkill {
  name: string;
  skillMd: string;
  workflow: string;
  schema: string;
}

export interface RunResult {
  text: string;
  data?: string;
  format?: string;
  steps: StepDetail[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  /** Wall-clock duration of the run in milliseconds */
  durationMs?: number;
  exportedSkill?: ExportedSkill;
}
