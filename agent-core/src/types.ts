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
  provider: "gateway" | "anthropic" | "openai" | "google" | "firecrawl" | "acp";
  model: string;
  apiKey?: string;
  bin?: string;
}

export interface SubAgentConfig {
  id: string;
  name: string;
  description: string;
  model: ModelConfig;
  tools: ("search" | "scrape" | "interact" | "map")[];
  skills: string[];
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
  csvContext?: string;
  uploads?: UploadedFile[];
  model: ModelConfig;
  subAgentModel?: ModelConfig;
  operationModels?: Record<string, ModelConfig>;
  skills: string[];
  skillInstructions?: Record<string, string>;
  subAgents: SubAgentConfig[];
  maxSteps?: number;
}

// --- Agent Core public API types ---

export interface CreateAgentOptions {
  /** Firecrawl API key — used to build the default toolkit */
  firecrawlApiKey: string;
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
}

export interface RunParams {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  format?: "json" | "csv" | "markdown";
  columns?: string[];
  uploads?: UploadedFile[];
  skills?: string[];
  skillInstructions?: Record<string, string>;
  subAgents?: SubAgentConfig[];
  maxSteps?: number;
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

export interface RunResult {
  text: string;
  data?: string;
  format?: string;
  steps: StepDetail[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}
