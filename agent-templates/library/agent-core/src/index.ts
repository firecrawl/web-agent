/**
 * @firecrawl/agent-core — public API entry point.
 *
 * Most apps start with `createAgent`:
 *
 * ```ts
 * import { createAgent } from '@firecrawl/agent-core';
 *
 * const agent = createAgent({
 *   firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
 *   model: { provider: 'google', model: 'gemini-3-flash-preview' },
 * });
 *
 * const result = await agent.run({ prompt: 'get firecrawl pricing' });
 * ```
 *
 * See agent-core/README.md for the full API reference and openapi.yaml
 * for the HTTP-side schema that templates implement.
 */

// ─── Agent factory & class ───
export { createAgent, createAgentFromEnv, FirecrawlAgent } from "./agent";

// ─── Lower-level orchestrator (if you want to bypass createAgent) ───
export { createOrchestrator, type OrchestratorOptions } from "./orchestrator";
export { createSubAgentTools } from "./orchestrator/sub-agents";
export { loadOrchestratorPrompt } from "./orchestrator/loader";

// ─── Parallel workers ───
export { createWorkerTool, workerProgress, type WorkerProgress, type WorkerResult } from "./worker";
export { loadWorkerPrompt } from "./worker/loader";

// ─── Model resolution ───
export { resolveModel } from "./resolve-model";

// ─── Skills ───
export { discoverSkills, buildDomainIndex, getDefaultSkillsDir } from "./skills/discovery";
export { createSkillTools } from "./skills/tools";
export { parseSkillBody, validateSkillContent, type SkillValidationResult } from "./skills/parser";
export { uploadSkills, type SkillUploadFile, type SkillUploadResult } from "./skills/upload";

// ─── Built-in tools (formatOutput, bashExec, exportSkill) ───
export { formatOutput, bashExec, initBashWithFiles, listBashFiles, readBashFile, createExportSkillTool } from "./tools";

// ─── Schema validation (shared between orchestrator prompt, formatOutput gate, and post-run assessment) ───
export { validateAgainstSchema, extractFieldPaths, coerceToJson } from "./schema-validate";
export type { SchemaValidationResult } from "./schema-validate";

// ─── Firecrawl toolkit integration ───
export { buildFirecrawlToolkit } from "./toolkit";
export { firecrawlTools, firecrawlSystemPrompt, utilityTools } from "./firecrawl-tools";

// ─── AI SDK ↔ LangChain adapter ───
export { aiToLc, aiToolkitToLc, coerceStringifiedJson, type AISDKTool } from "./adapter";

// ─── Streaming helpers (framework-agnostic) ───
export { streamEvents, toResponse, toSSE } from "./stream-helpers";

// ─── Tool result parsing ───
export { parseToolResult, normalizeToolOutput } from "./tool-results";
export type {
  ParseToolResult,
  ParseToolResultInput,
  ToolResultPayload,
  SearchResultPayload,
  SearchResultRow,
  ScrapeResultPayload,
  ScrapeBashLoadPayload,
  ScrapeBashLoadedPage,
  BashResultPayload,
  UnknownToolPayload,
} from "./tool-results";

// ─── Public types ───
export type {
  CreateAgentOptions,
  RunParams,
  RunResult,
  ExportedSkill,
  StepEvent,
  AgentEvent,
  StepDetail,
  AgentConfig,
  ModelConfig,
  SubAgentConfig,
  SkillMetadata,
  SitePlaybook,
  Toolkit,
  UploadedFile,
  FirecrawlToolsConfig,
  SchemaMismatch,
} from "./types";
