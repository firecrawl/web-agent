export interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

export interface ModelConfig {
  provider: "gateway" | "anthropic" | "openai" | "google" | "acp";
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

export interface SkillMetadata {
  name: string;
  description: string;
  category?: string;
  directory: string;
  resources: string[];
}

export interface AgentConfig {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
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
  firecrawlApiKey: string;
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
