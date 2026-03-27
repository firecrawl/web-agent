export interface AgentConfig {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  csvContext?: string;
  model: ModelConfig;
  skills: string[];
  subAgents: SubAgentConfig[];
  maxSteps?: number;
}

export interface ModelConfig {
  provider: "gateway" | "anthropic" | "openai" | "google";
  model: string;
  apiKey?: string;
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
  directory: string;
  resources: string[];
}
