// Public API
export { createAgent, FirecrawlAgent } from "./agent";
export { createOrchestrator, type OrchestratorOptions } from "./orchestrator";
export { createWorkerTool, workerProgress, type WorkerProgress, type WorkerResult } from "./workers";
export { createSubAgentTools } from "./sub-agents";
export { resolveModel } from "./resolve-model";
export { discoverSkills } from "./skills/discovery";
export { createSkillTools } from "./skills/tools";
export { formatOutput, bashExec, initBashWithFiles, listBashFiles, readBashFile } from "./tools";
export { loadOrchestratorPrompt, loadWorkerPrompt, setPromptsDir } from "./prompts/loader";

// Types
export type {
  CreateAgentOptions,
  RunParams,
  RunResult,
  StepEvent,
  AgentEvent,
  StepDetail,
  AgentConfig,
  ModelConfig,
  SubAgentConfig,
  SkillMetadata,
  UploadedFile,
} from "./types";
