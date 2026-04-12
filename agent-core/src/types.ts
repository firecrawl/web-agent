import type { SubAgent } from "deepagents";

/**
 * Model config. Accepts either a simple provider:model string like
 * "anthropic:claude-sonnet-4-6" or a structured config with overrides.
 * Strings go through langchain's `initChatModel` universal factory.
 */
export interface ModelConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface FirecrawlToolsConfig {
  search?: Record<string, unknown> | false;
  scrape?: Record<string, unknown> | false;
  interact?: Record<string, unknown> | false;
  map?: boolean;
  crawl?: boolean;
  maxResponseTokens?: number;
}

export interface CreateFirecrawlAgentOptions {
  /** Firecrawl API key — omit if you only want utility tools (bash, formatOutput). */
  firecrawlApiKey?: string;
  firecrawlOptions?: FirecrawlToolsConfig;
  /**
   * Either a provider:model string ("openai:gpt-5.4", "anthropic:claude-sonnet-4-6")
   * or a structured ModelConfig. Strings are preferred for simplicity.
   */
  model: string | ModelConfig;
  /** Additional LangChain tools to merge alongside Firecrawl + utility tools. */
  tools?: any[];
  /** Sub-agent definitions in Deep Agents shape. */
  subagents?: SubAgent[];
  /** Additional skill directories to load alongside the built-in ones. */
  skills?: string[];
  /** Override the default skills directory (point at your own SKILL.md files). */
  skillsDir?: string;
  /**
   * System prompt. If omitted, Firecrawl's authored prompt (tool usage
   * guidance) is used. Pass "" to skip it entirely.
   */
  systemPrompt?: string;
  /** Extra API keys keyed by provider name (anthropic, openai, google, etc.). */
  apiKeys?: Record<string, string>;
}
