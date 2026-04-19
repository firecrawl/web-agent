import type { ToolSet } from "ai";

/**
 * A user-uploaded file made available to the agent via the bash sandbox.
 * Written to /data/<name> before the run starts.
 */
export interface UploadedFile {
  /** Filename including extension (e.g. "products.csv") */
  name: string;
  /** MIME type — informational, not used for content handling */
  type: string;
  /** File contents as a string (binary files should be base64-encoded) */
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
  /** LLM provider. "gateway" = Vercel AI Gateway, "custom-openai" = any OpenAI-compatible endpoint */
  provider: "gateway" | "anthropic" | "openai" | "google" | "custom-openai";
  /** Model ID (e.g. "claude-sonnet-4-6", "gemini-3-flash-preview", "gpt-5.4") */
  model: string;
  /** Override the provider API key for this specific model */
  apiKey?: string;
  /** Custom endpoint URL — required for custom-openai, optional for others */
  baseURL?: string;
  /** Reserved for future CLI/binary routing */
  bin?: string;
}

export interface SubAgentConfig {
  /** Unique identifier used as the tool name suffix (e.g. "vercel_researcher") */
  id: string;
  /** Human-readable name surfaced to the orchestrator */
  name: string;
  /** What this sub-agent does — included in the tool description so the orchestrator knows when to delegate */
  description: string;
  /** Optional instructions appended to the sub-agent's system prompt */
  instructions?: string;
  /** Model for this sub-agent. Different sub-agents can use different models */
  model: ModelConfig;
  /** Which Firecrawl tools this sub-agent can access */
  tools: ("search" | "scrape" | "interact" | "map")[];
  /** Skill slugs to pre-load for this sub-agent */
  skills: string[];
  /** Max steps this sub-agent can take before returning */
  maxSteps?: number;
}

/**
 * A site-specific playbook attached to a skill — matched against URL
 * domains so the right skill loads automatically when the agent visits
 * a known site.
 */
export interface SitePlaybook {
  /** Slug of the playbook (derived from filename) */
  name: string;
  /** Human-readable platform identifier (e.g. "Shopify", "Yahoo Finance") */
  platform: string;
  /** Hostnames this playbook applies to — matched case-insensitively */
  domains: string[];
  /** Absolute path to the playbook markdown file */
  filePath: string;
}

/**
 * Discovered skill — the runtime representation of a SKILL.md playbook
 * plus any site-specific addenda.
 */
export interface SkillMetadata {
  /** Slug from the SKILL.md frontmatter (e.g. "pricing-tracker") */
  name: string;
  /** One-line description shown to the agent when deciding to load the skill */
  description: string;
  /** Optional grouping label (e.g. "Research", "E-commerce") */
  category?: string;
  /** Absolute path to the skill's directory */
  directory: string;
  /** Extra files in the skill directory that aren't SKILL.md */
  resources: string[];
  /** Site-specific playbooks nested under the skill's sites/ subfolder */
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
  /** Model used by the orchestrator (plan-act loop) */
  model: ModelConfig;
  /** Model used by parallel sub-agents. Defaults to `model` if omitted */
  subAgentModel?: ModelConfig;
  /** Provider API keys map (e.g. { anthropic: "sk-ant-...", google: "AIza..." }) */
  apiKeys?: Record<string, string>;
  /** Path to a custom skills directory. Defaults to the built-in definitions */
  skillsDir?: string;
  /** Path to a custom prompts directory. Overrides built-in orchestrator/worker prompts */
  promptsDir?: string;
  /** Max orchestrator steps (default: 50) */
  maxSteps?: number;
  /** Max concurrent sub-agents (default: 6) */
  maxWorkers?: number;
  /** Max steps per sub-agent (default: 15) */
  workerMaxSteps?: number;
  /**
   * App-specific prompt sections appended to the base system prompt.
   * Use this to inject UI-specific policies (planning style, presentation mode,
   * workflow examples) without modifying agent-core.
   */
  appSections?: string[];
}

export interface RunParams {
  /** The research task or question for the agent */
  prompt: string;
  /** Seed URLs for the agent to start from instead of searching */
  urls?: string[];
  /** JSON schema describing the expected output shape (used with format=json) */
  schema?: Record<string, unknown>;
  /** Output format. If set, formatOutput is called to coerce the final response */
  format?: "json" | "markdown";
  /** Column names the agent should extract — useful for tabular data */
  columns?: string[];
  /** Files to load into the bash sandbox before the run starts */
  uploads?: UploadedFile[];
  /** Skill slugs to pre-load (bypass on-demand skill loading) */
  skills?: string[];
  /** Per-skill custom instructions appended when the skill is loaded */
  skillInstructions?: Record<string, string>;
  /** Sub-agents available during this run, exposed as tools to the orchestrator */
  subAgents?: SubAgentConfig[];
  /** Hard cap on orchestrator steps — prevents runaway loops */
  maxSteps?: number;
  /** When true, post-processes the run into a reusable skill (SKILL.md + workflow.mjs + schema.json) */
  exportSkill?: boolean;
  /** Callback fired for each significant step during the run */
  onStep?: (event: StepEvent) => void;
}

/**
 * Emitted to the onStep callback after a run completes (replayed from the
 * step list). Lighter than AgentEvent — no "done" / "error" lifecycle events.
 */
export interface StepEvent {
  type: "text" | "tool-call" | "tool-result" | "usage";
  /** Assistant-generated text for this step (type: "text") */
  text?: string;
  /** Tool name for tool-call / tool-result events */
  toolName?: string;
  /** Arguments passed to the tool (tool-call) */
  input?: unknown;
  /** Tool return value (tool-result) */
  output?: unknown;
  /** Token usage for this step (type: "usage") */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

/**
 * Events yielded by `agent.stream()`. The relevant fields depend on `type`:
 *   - "text":        content
 *   - "tool-call":   toolName, input
 *   - "tool-result": toolName, output
 *   - "usage":       usage
 *   - "done":        text, steps, usage, durationMs, model
 *   - "error":       error
 */
export interface AgentEvent {
  type: "text" | "tool-call" | "tool-result" | "usage" | "done" | "error";
  /** Assistant-generated text delta (type: "text") */
  content?: string;
  /** Tool name for tool-call / tool-result events */
  toolName?: string;
  /** Arguments passed to the tool (tool-call) */
  input?: unknown;
  /** Tool return value (tool-result) */
  output?: unknown;
  /** Final token usage (type: "done") or per-step usage */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  /** Final text response (type: "done") */
  text?: string;
  /** Full step-by-step record (type: "done") */
  steps?: StepDetail[];
  /** Error message (type: "error") */
  error?: string;
  /** On "done": wall-clock duration of the stream in milliseconds */
  durationMs?: number;
  /** On "done": model that produced this response, as "provider:id" */
  model?: string;
  /** On "done": schema divergence when `schema` was requested but not fully met */
  schemaMismatch?: SchemaMismatch;
}

/**
 * A single step in the agent loop — the assistant's text output along with
 * any tool calls it made and results it received.
 */
export interface StepDetail {
  /** Assistant-generated text for this step (may be empty if the step was pure tool use) */
  text: string;
  /** Tool calls made during this step */
  toolCalls: { name: string; input: unknown }[];
  /** Results returned by those tool calls */
  toolResults: { name: string; output: unknown }[];
}

/**
 * A reusable skill package generated from a successful run.
 * Present on RunResult when the run was called with exportSkill=true.
 */
export interface ExportedSkill {
  /** Slug identifier (kebab-case) */
  name: string;
  /** Full SKILL.md source with frontmatter */
  skillMd: string;
  /** Deterministic workflow.mjs script that replays the run's steps */
  workflow: string;
  /** JSON schema for the expected output shape */
  schema: string;
}

export type { SchemaMismatch } from "./schema-validate";
import type { SchemaMismatch } from "./schema-validate";

export interface RunResult {
  /** The agent's final text response (or formatted data for json/markdown format) */
  text: string;
  /** Formatted output when format was set — same value as text for convenience */
  data?: string;
  /** Which format was used for the output ("json" | "markdown" | "text") */
  format?: string;
  /** Step-by-step record of what the agent did */
  steps: StepDetail[];
  /** Total token usage across the orchestrator + all sub-agents */
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  /** Wall-clock duration of the run in milliseconds */
  durationMs?: number;
  /** Model that produced this response, as "provider:id" */
  model?: string;
  /** Reusable skill package (present when exportSkill=true) */
  exportedSkill?: ExportedSkill;
  /**
   * Set when `schema` was provided and the final output didn't fully match.
   * Undefined means either no schema was requested, or the output passed.
   */
  schemaMismatch?: SchemaMismatch;
}
