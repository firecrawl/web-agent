import { ToolLoopAgent, stepCountIs } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { AgentConfig } from "../types";
import { resolveModel } from "../config/resolve-model";
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
  const skillTools = createSkillTools(skills, config.skillInstructions);

  // Resolve sub-agent model (falls back to orchestrator model)
  const subAgentModelResolved = config.subAgentModel
    ? await resolveModel(config.subAgentModel)
    : model;

  // All sub-agents (user-configured + built-in exports) get the full toolkit
  const subAgentTools = await createSubAgentTools(
    config.subAgents,
    firecrawlApiKey,
    skills,
    subAgentModelResolved,
    config.skillInstructions,
  );

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

  // Pre-seed bash filesystem with uploaded files
  const uploadedFiles: Record<string, string> = {};
  const uploadDescriptions: string[] = [];

  if (config.csvContext) {
    uploadedFiles["/data/input.csv"] = config.csvContext;
    uploadDescriptions.push("/data/input.csv (CSV)");
  }

  if (config.uploads?.length) {
    for (const upload of config.uploads) {
      const isText = upload.type.startsWith("text/") || /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(upload.name);
      const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `/data/${safeName}`;
      if (isText) {
        uploadedFiles[path] = upload.content;
      } else {
        // Binary files: store base64 content
        uploadedFiles[path + ".b64"] = upload.content;
      }
      uploadDescriptions.push(`${path} (${upload.type || upload.name.split(".").pop()})`);
    }
  }

  if (Object.keys(uploadedFiles).length > 0) {
    await initBashWithFiles(uploadedFiles);
  }

  const uploadHint = uploadDescriptions.length > 0
    ? `\n\nThe user uploaded files to the bash filesystem:\n${uploadDescriptions.map((d) => `- ${d}`).join("\n")}\nUse bashExec to explore them: 'head -5 /data/file.csv', 'cat /data/file.json | jq .', 'wc -l /data/file.txt', etc.`
    : "";

  const instructions = `You are a web research agent powered by Firecrawl. You help users scrape, search, and extract structured data from the web.

Today's date is ${new Date().toISOString().split("T")[0]}.

${fcSystemPrompt ?? ""}

## How you work
You gather context iteratively through conversation. The user will tell you what they need, and you go get it. Keep it conversational — ask short follow-ups if something is ambiguous, but bias toward action.

## Planning — ALWAYS start with a mermaid diagram
Before doing ANY work, you MUST output a mermaid flowchart showing your execution plan. This is mandatory for every task — the user needs to see the approach before you start.

\`\`\`mermaid
graph TD
    A[Search for sources] --> B[Scrape Site 1]
    A --> C[Scrape Site 2]
    B --> D[Compile & compare]
    C --> D
    D --> E[Save to /data/]
\`\`\`

Rules:
- Always use \`graph TD\` (top-down) layout
- 4-10 nodes — show the key steps, not every detail
- Label nodes with the action (Search, Scrape, Compare, Save, etc.)
- Show parallel branches where applicable
- After the diagram, immediately start executing — no extra narration

## Style
- Never use emojis in your responses.
- Be concise and professional. No filler words.
- When presenting data, use clean formatting — no decorative characters.

## Gathering data
- Think step by step. Narrate what you're doing and why — the user sees your text in real-time.
- Use search to discover relevant pages when you don't have specific URLs.
- Use scrape to extract content from pages. For targeted extraction, use the query parameter.
- CRITICAL: Only scrape URLs that were returned in search results or provided by the user. NEVER guess, invent, or construct URLs. If a search returns no results for a specific site, try a different search query or a different source — do not fabricate a URL.
- If a scrape returns a 404, access error, or bot-check page (e.g. "Checking your browser", "Verification failed"), do NOT retry the same URL. Move on to a different source.
- Use interact for pages that need JavaScript interaction (clicks, forms, pagination).
- Use bashExec for data processing. ONLY these commands are available: jq, awk, sed, grep, sort, uniq, wc, head, tail, cut, tr, paste, cat, echo, printf, expr, ls, mkdir, rm, cp, mv, tee, xargs. Write intermediate results to files so you can build on them.
- CRITICAL: The bash sandbox is a minimal shell — python, python3, node, curl, wget, npm, pip, bc, ruby, perl ARE NOT AVAILABLE. Do not attempt to use them. If you try, the command will fail. For JSON always use jq. For CSV always use awk. For math use awk (e.g. awk 'BEGIN{print 10*1.5}') or expr.
- Prefer using scrape with a query parameter for targeted extraction -- this is the most efficient approach. For full page content, use formats: ["markdown"]. Only use formats: ["json"] when the user explicitly asks for structured JSON or provides a schema.
- Store collected data in the bash filesystem (e.g. /data/results.json) as you go so nothing is lost.

## Skills
- When you encounter a domain that matches an available skill, load it immediately with load_skill. Don't wait to be asked.
- Skills give you specialized instructions, templates, and scripts for specific domains (e.g. pricing analysis, SEO audits).
- After loading a skill, follow its instructions and use read_skill_resource to access any scripts or reference files it provides.
- You can load multiple skills in a single session if the task spans domains.${skillCatalog}

## Output and formatting
- You have sub-agents for creating formatted output: subagent_create_json, subagent_create_csv, subagent_create_markdown. Each is a mini version of you with the full toolkit.
- When the user asks for a specific format, delegate to the matching sub-agent and pass ALL collected data as the task.
- If you have no matching sub-agent tool, call formatOutput directly.
- IMPORTANT: Always write formatted output to a file in /data/ (e.g. /data/results.json, /data/results.csv) using bashExec. Use jq for JSON formatting and awk for CSV generation.
- When you call formatOutput, do NOT repeat or describe the formatted content in your text response. The UI renders the output automatically. Just call the tool and move on.${schemaHint}${urlHint}${uploadHint}`;

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
