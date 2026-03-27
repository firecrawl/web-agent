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

  const instructions = `You are a web research agent powered by Firecrawl. Autonomously scrape, search, and interact with the web to fulfill the user's request.

${fcSystemPrompt ?? ""}

Guidelines:
- Plan your approach before acting
- Use search to discover relevant pages when you don't have specific URLs
- Use scrape to extract content from pages
- Use interact for pages that need JavaScript interaction (clicks, forms, pagination)
- Use bashExec for data processing: jq, awk, sed, grep, sort — great for transforming scraped data
- When done, use formatOutput to present results in the requested format
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
  });
}
