import { ToolLoopAgent, stepCountIs } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { AgentConfig } from "../types";
import { resolveModel } from "../config/resolve-model";
import { createSkillTools } from "../skills/tools";
import { createSubAgentTools } from "./sub-agents";
import { createWorkerTool } from "./workers";
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

## Planning — use mermaid diagrams for research tasks
Before doing research or data collection work, output a mermaid flowchart showing your execution plan. Skip the mermaid diagram for simple formatting/export tasks (e.g. "format as JSON", "format as CSV", "format as markdown" — just do it directly).

\`\`\`mermaid
graph TD
    A[Search for sources] --> B[Scrape Site 1]
    A --> C[Scrape Site 2]
    B --> D[Compile & compare]
    C --> D
    D --> E[Output table]
\`\`\`

Rules:
- Always use \`graph TD\` (top-down) layout
- 4-12 nodes — show the key steps
- Label nodes with the action (Search, Scrape, Compare, Output, etc.)
- Show parallel branches where applicable — especially when using spawnWorkers
- After the diagram, immediately start executing

Updating the plan:
- If your approach changes mid-task (source unavailable, new data discovered, task more complex than expected), output an UPDATED mermaid diagram. Mark completed steps with ✓ and highlight changes.
- Example mid-task update:

\`\`\`mermaid
graph TD
    A[✓ Search for sources] --> B[✓ Scrape Site 1]
    A --> C[Scrape Site 2 - 404]
    A --> F[Scrape Site 3 - NEW]
    B --> D[Compile & compare]
    F --> D
    D --> E[Output table]
    style C fill:#fee,stroke:#f66
    style F fill:#efe,stroke:#6b6
\`\`\`

- Update the plan whenever: a worker fails, a new source is found, the approach pivots, or you're about to start a new phase.

## Parallel workers — use spawnWorkers for independent tasks
When you have 2+ independent data collection tasks (researching multiple companies, scraping multiple sites, analyzing multiple stocks), use the \`spawnWorkers\` tool to run them in parallel:

spawnWorkers({ tasks: [
  { id: "vercel", prompt: "Search for and scrape Vercel's pricing page. Extract all plan tiers with prices and features." },
  { id: "netlify", prompt: "Search for and scrape Netlify's pricing page. Extract all plan tiers with prices and features." },
  { id: "cloudflare", prompt: "Search for and scrape Cloudflare Pages pricing. Extract all plan tiers with prices and features." },
]})

Each worker gets its own isolated context and full toolkit. Workers return only a concise result — your context stays clean. Always show the parallel branches in your mermaid plan:

\`\`\`mermaid
graph TD
    A[Plan] --> W{spawnWorkers}
    W --> B[Worker: Vercel]
    W --> C[Worker: Netlify]
    W --> D[Worker: Cloudflare]
    B --> E[Compile results]
    C --> E
    D --> E
    E --> F[Output comparison table]
\`\`\`

Use spawnWorkers when:
- Comparing 2+ companies, products, or services
- Researching multiple stocks or financial instruments
- Scraping multiple sites for the same type of data
- Any task where work can be divided into independent chunks

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

## Scraping strategy — use query smartly
- Use scrape with a query parameter for targeted extraction — it's the most efficient approach and keeps context lean.
- IMPORTANT: When scraping lists/collections, ALWAYS include pagination awareness in your query. Ask for totals and pagination info alongside the data. Examples:
  - "List all products with name and price. Also tell me: how many total results are shown? Is there a next page, load more button, or pagination? What page is this (e.g. page 1 of 5, showing 1-24 of 200)?"
  - "Extract all company names and descriptions. How many total companies are listed? Are there more pages?"
- If the response indicates there are more pages (e.g. "showing 24 of 200", "page 1 of 8", "next page available"), use interact to paginate or scrape the next page URL. Keep going until you have all the data.
- For full page content when you need to see everything, use formats: ["markdown"]. But prefer query for most tasks — it's lighter on context.
- When you see truncated results, say so and keep going — don't present partial data as complete.

## Skills
- When you encounter a domain that matches an available skill, load it immediately with load_skill. Don't wait to be asked.
- Skills give you specialized instructions, templates, and scripts for specific domains (e.g. pricing analysis, SEO audits).
- After loading a skill, follow its instructions and use read_skill_resource to access any scripts or reference files it provides.
- You can load multiple skills in a single session if the task spans domains.${skillCatalog}

## Presenting results — STREAM INLINE
- When you have collected data, OUTPUT IT DIRECTLY in your response. Do NOT write a narrative summary — just stream the actual data.
- For tabular data (CSV, spreadsheets, comparisons): ALWAYS use a **markdown table** format. The UI renders markdown tables beautifully with sorting, download (CSV/JSON), hover states, and responsive scrolling.
- IMPORTANT: ALWAYS include a "Source" column in every table with the full URL as a markdown link. This is mandatory — every row of data must be traceable to its source. Example:

| Company | Plan | Price | Source |
|---------|------|-------|--------|
| Vercel | Pro | $20/mo | [vercel.com](https://vercel.com/pricing) |
| Netlify | Pro | $19/mo | [netlify.com](https://www.netlify.com/pricing/) |

- For JSON: include a "source" field with the full URL for every object.
- Do NOT use \`\`\`csv or \`\`\`markdown code blocks. CSV data goes in markdown tables. Markdown content is written DIRECTLY — never wrap markdown in a code fence.
- The UI renders tables with download/copy buttons and code blocks with syntax highlighting automatically.
- Do NOT call formatOutput or sub-agents unless explicitly asked. Do NOT write to bash just to format output. Just stream the data inline.
- Only use bashExec to SAVE data to /data/ when: (a) the dataset is very large (100+ rows), (b) you need to process it further, or (c) you want to persist intermediate results between steps.
- Keep narration minimal — a one-line summary before the data block is fine. No paragraphs explaining what you're about to show.${schemaHint}${urlHint}${uploadHint}`;

  const spawnWorkers = createWorkerTool(model, firecrawlApiKey, skills);

  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      ...fcTools,
      ...skillTools,
      ...subAgentTools,
      spawnWorkers,
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
