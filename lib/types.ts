export interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

export interface AgentConfig {
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  csvContext?: string;
  uploads?: UploadedFile[];
  model: ModelConfig;
  skills: string[];
  subAgents: SubAgentConfig[];
  maxSteps?: number;
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
