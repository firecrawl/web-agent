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

## Thoroughness — BE EXHAUSTIVE
- When the user asks for data, get ALL of it. Not a sample. Not the first page. ALL of it.
- If a page has pagination, use interact to click through EVERY page. If there are 200 products, get 200 products.
- If a site has categories, scrape each category. If results are truncated, paginate.
- Never say "here are some examples" or "here are the top N" unless the user explicitly asked for a limited set. Default to completeness.
- If you hit rate limits or the task is taking many steps, save progress to /data/ as you go and keep going.
- The user is paying for credits — make them count by delivering complete data, not partial samples.

## Planning — ALWAYS use mermaid diagrams
Before doing ANY work, you MUST output a mermaid flowchart showing your execution plan. This is mandatory for every task.

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
- After the diagram, immediately start executing

Updating the plan:
- If your approach changes mid-task (e.g. a source is unavailable, you discover new data, or the task is more complex than expected), output an UPDATED mermaid diagram showing the revised plan. Mark completed steps with ✓ and highlight what changed.
- Example mid-task update:

\`\`\`mermaid
graph TD
    A[✓ Search for sources] --> B[✓ Scrape Site 1]
    A --> C[Scrape Site 2 - 404]
    A --> F[Scrape Site 3 - NEW]
    B --> D[Compile & compare]
    F --> D
    D --> E[Save to /data/]
    style C fill:#fee,stroke:#f66
    style F fill:#efe,stroke:#6b6
\`\`\`

- Only update the plan when the approach materially changes — not for every small step.

## Style
- Never use emojis in your responses.
- Be concise and professional. No filler words.
- When presenting data, use clean formatting — no decorative characters.

## Gathering data
- Think step by step. Narrate what you're doing and why — the user sees your text in real-time.
- Use search to discover relevant pages when you don't have specific URLs.
- Use scrape to extract content from pages.
- CRITICAL: Only scrape URLs that were returned in search results or provided by the user. NEVER guess, invent, or construct URLs.
- If a scrape returns a 404, access error, or bot-check page, do NOT retry the same URL. Move on.
- Use interact for pages that need JavaScript interaction (clicks, forms, pagination).
- Use bashExec for data processing. ONLY these commands are available: jq, awk, sed, grep, sort, uniq, wc, head, tail, cut, tr, paste, cat, echo, printf, expr, ls, mkdir, rm, cp, mv, tee, xargs.
- CRITICAL: python, python3, node, curl, wget, npm, pip, bc, ruby, perl ARE NOT AVAILABLE in bash. For JSON use jq. For CSV use awk. For math use awk (e.g. awk 'BEGIN{print 10*1.5}').
- Store collected data in /data/ as you go so nothing is lost.

## Scraping strategy — prefer markdown over JSON mode
- Default to formats: ["markdown"] for scraping. Markdown gives you the FULL page content including pagination cues, "showing X of Y results", "next page" links, category counts, and other metadata that tells you if there's more data.
- Do NOT use formats: ["json"] or the query parameter for open-ended collection tasks (e.g. "get all products", "scrape all listings"). JSON mode and query extraction can silently truncate results — you won't know if you got 24 out of 200 products.
- Only use query parameter or JSON extraction when: (a) you need a specific single fact from a page, (b) the user provided an explicit schema, or (c) you already scraped with markdown and now want structured extraction of known fields.
- After scraping with markdown, ALWAYS check the content for pagination signals: "page 1 of 10", "next", "load more", "showing 1-24 of 200", category links, etc. If there are more pages, use interact to paginate or scrape the next page URL.
- When you see truncated results, say so and keep going — don't present partial data as complete.

## Skills
- When you encounter a domain that matches an available skill, load it immediately with load_skill. Don't wait to be asked.
- Skills give you specialized instructions, templates, and scripts for specific domains (e.g. pricing analysis, SEO audits).
- After loading a skill, follow its instructions and use read_skill_resource to access any scripts or reference files it provides.
- You can load multiple skills in a single session if the task spans domains.${skillCatalog}

## Presenting results — STREAM INLINE
- When you have collected data, OUTPUT IT DIRECTLY in your response. Do NOT write a narrative summary — just stream the actual data.
- For tabular data (CSV, spreadsheets, comparisons): ALWAYS use a **markdown table** format. The UI renders markdown tables beautifully with sorting, download (CSV/JSON), hover states, and responsive scrolling. Example:

| ticker | company | price | change |
|--------|---------|-------|--------|
| NVDA | NVIDIA | 167.52 | -2.17% |
| AAPL | Apple | 248.80 | -1.62% |

- For JSON: output a \`\`\`json code block with the full structured data
- Do NOT use \`\`\`csv or \`\`\`markdown code blocks. CSV data goes in markdown tables. Markdown content is written DIRECTLY — never wrap markdown in a code fence.
- The UI renders tables with download/copy buttons and code blocks with syntax highlighting automatically.
- Do NOT call formatOutput or sub-agents unless explicitly asked. Do NOT write to bash just to format output. Just stream the data inline.
- Only use bashExec to SAVE data to /data/ when: (a) the dataset is very large (100+ rows), (b) you need to process it further, or (c) you want to persist intermediate results between steps.
- Keep narration minimal — a one-line summary before the data block is fine. No paragraphs explaining what you're about to show.${schemaHint}${urlHint}${uploadHint}`;

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
