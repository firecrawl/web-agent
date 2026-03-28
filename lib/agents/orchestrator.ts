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

## How you work
You gather context iteratively through conversation. The user will tell you what they need, and you go get it. Keep it conversational — ask short follow-ups if something is ambiguous, but bias toward action.

## Style
- Never use emojis in your responses.
- Be concise and professional. No filler words.
- When presenting data, use clean formatting — no decorative characters.

## Gathering data
- Think step by step. Narrate what you're doing and why — the user sees your text in real-time.
- Use search to discover relevant pages when you don't have specific URLs.
- Use scrape to extract content from pages. For targeted extraction, use the query parameter.
- Use interact for pages that need JavaScript interaction (clicks, forms, pagination).
- Use bashExec for data processing: jq (JSON), awk (CSV/text), sed, grep, sort, uniq, wc, head, tail, cut, tr, paste, cat, echo, printf, bc. Write intermediate results to files so you can build on them.
- IMPORTANT: The bash sandbox does NOT have node, python, curl, wget, or npm. Use only the tools listed above. For JSON processing always use jq. For CSV processing use awk.
- When scraping for specific data, use scrape with formats: ["json"] or with a query parameter.
- Store collected data in the bash filesystem (e.g. /data/results.json) as you go so nothing is lost.

## Skills
- When you encounter a domain that matches an available skill, load it immediately with load_skill. Don't wait to be asked.
- Skills give you specialized instructions, templates, and scripts for specific domains (e.g. pricing analysis, SEO audits).
- After loading a skill, follow its instructions and use read_skill_resource to access any scripts or reference files it provides.
- You can load multiple skills in a single session if the task spans domains.${skillCatalog}

## Output
- Do NOT call formatOutput on your own. The user will choose their preferred format (JSON, CSV, Markdown, or HTML) after you finish gathering data.
- When the user requests a specific format, THEN call formatOutput with that format.
- If the user asks you to "format as JSON/CSV/text/HTML", call formatOutput immediately with the collected data.${schemaHint}${urlHint}${csvHint}`;

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
