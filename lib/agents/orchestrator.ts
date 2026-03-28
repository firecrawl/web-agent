import { ToolLoopAgent, stepCountIs } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { AgentConfig } from "../types";
import { resolveModel } from "../config/models";
import { createSkillTools } from "../skills/tools";
import { createSubAgentTools } from "./sub-agents";
import { formatOutput } from "./tools";
import { bashExec, initBashWithFiles } from "./bash-tool";
import { discoverSkills } from "../skills/discovery";

export async function createOrchestrator(
  config: AgentConfig,
  firecrawlApiKey: string,
) {
  const model = await resolveModel(config.model);
  const skills = await discoverSkills();

  const { systemPrompt: fcSystemPrompt, ...fcTools } = FirecrawlTools({
    apiKey: firecrawlApiKey,
  });
  const skillTools = createSkillTools(skills);

  const subAgentTools =
    config.subAgents.length > 0
      ? await createSubAgentTools(config.subAgents, firecrawlApiKey, skills)
      : {};

  // Skill catalog for system prompt (~100 tokens per skill)
  const skillCatalog = skills.length
    ? `\n\nAvailable skills (use load_skill to activate):\n${skills.map((s) => `- ${s.name}: ${s.description.slice(0, 100)}`).join("\n")}`
    : "";

  const schemaHint = config.schema
    ? `\n\nStructure your output to match this JSON schema:\n${JSON.stringify(config.schema, null, 2)}\nUse formatOutput with format "json" when done.`
    : "";

  const urlHint =
    config.urls && config.urls.length > 0
      ? `\n\nStart with these URLs: ${config.urls.join(", ")}`
      : "";

  // Pre-seed bash filesystem with uploaded CSV
  if (config.csvContext) {
    await initBashWithFiles({ "/data/input.csv": config.csvContext });
  }

  const csvHint = config.csvContext
    ? `\n\nThe user uploaded a CSV file. It's available at /data/input.csv in the bash filesystem. Use bashExec to explore it: 'head -5 /data/input.csv', 'wc -l /data/input.csv', 'awk -F, ...' etc.`
    : "";

  const instructions = `You are a web research agent powered by Firecrawl. You help users scrape, search, and extract structured data from the web.

${fcSystemPrompt ?? ""}

## Phase 1: Clarify (ALWAYS do this first)
Before doing any research, briefly confirm with the user:
1. What output format they want (JSON, CSV, or text summary)
2. What specific fields/columns they need (if structured data)
3. Any scope constraints (how many items, which sites, date range)

Keep this short — 2-3 quick questions max. If the request is very clear and simple, you can skip straight to execution.

## Phase 2: Execute
- Think step by step. Narrate what you're doing and why — the user sees your text in real-time.
- Use search to discover relevant pages when you don't have specific URLs
- Use scrape to extract content from pages. For targeted extraction, use the query parameter.
- Use interact for pages that need JavaScript interaction (clicks, forms, pagination)
- Use bashExec for data processing: jq, awk, sed, grep, sort — great for transforming scraped data
- When scraping for specific data, use scrape with formats: ["json"] or with a query parameter

## Phase 3: Output
- ALWAYS call formatOutput as your final action:
  - Use format "json" for structured data (pricing, comparisons, lists of items)
  - Use format "csv" for tabular data (multiple items with consistent fields)
  - Use format "text" only for narrative summaries
- Load skills for domain expertise when relevant${skillCatalog}${schemaHint}${urlHint}${csvHint}`;

  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      ...fcTools,
      ...skillTools,
      ...subAgentTools,
      formatOutput,
      bashExec,
    },
    stopWhen: stepCountIs(config.maxSteps ?? 20),
    experimental_repairToolCall: async ({ toolCall, inputSchema }) => {
      // When the model sends extra fields that fail schema validation,
      // get the tool's schema and strip unknown properties from the JSON input
      try {
        const schema = await inputSchema({ toolName: toolCall.toolName });
        const allowedKeys = Object.keys(
          (schema as { properties?: Record<string, unknown> }).properties ?? {},
        );
        const parsed = JSON.parse(toolCall.input);
        const cleaned: Record<string, unknown> = {};
        for (const key of allowedKeys) {
          if (key in parsed) cleaned[key] = parsed[key];
        }
        return { ...toolCall, input: JSON.stringify(cleaned) };
      } catch {
        return toolCall;
      }
    },
  });
}
