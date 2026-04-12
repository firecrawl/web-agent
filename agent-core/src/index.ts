// Batteries-included factory
export { createFirecrawlAgent, createFirecrawlAgentFromEnv, DEFAULT_SKILLS_DIR } from "./agent";

// Composable primitives — use with createDeepAgent directly
export { firecrawlTools, firecrawlSystemPrompt, utilityTools } from "./firecrawl-tools";
export { aiToLc, aiToolkitToLc } from "./adapter";
export { resolveModel } from "./resolve-model";
export {
  formatOutput,
  bashExec,
  initBashWithFiles,
  listBashFiles,
  readBashFile,
  createExportSkillTool,
} from "./tools";

// Stream helpers — work with any Deep Agent / LangGraph runnable
export { streamEvents, toResponse, toSSE, type AgentEvent } from "./stream-helpers";

// Re-export deepagents primitives so users don't need a second install
export { createDeepAgent, type SubAgent } from "deepagents";

// Types
export type {
  CreateFirecrawlAgentOptions,
  ModelConfig,
  FirecrawlToolsConfig,
} from "./types";
