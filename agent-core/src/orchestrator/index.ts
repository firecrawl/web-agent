import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { AgentConfig, ModelConfig } from "../types";
import { resolveModel } from "../resolve-model";
import { createSkillTools } from "../skills/tools";
import { createSubAgentTools } from "./sub-agents";
import { createWorkerTool } from "../worker";
import { formatOutput, bashExec, initBashWithFiles } from "../tools";
import { discoverSkills } from "../skills/discovery";
import { loadOrchestratorPrompt } from "./loader";
import { createPrepareStepWithCompaction } from "./compaction";

// --- Research plan builder ---

function extractFieldPaths(obj: unknown, prefix = "", depth = 0): string[] {
  if (depth > 4) return [prefix || "(nested)"];
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [`${prefix}[]`];
    const item = obj[0];
    if (typeof item === "object" && item !== null) {
      return extractFieldPaths(item, `${prefix}[]`, depth + 1);
    }
    return [`${prefix}[] (get ALL items)`];
  }
  if (typeof obj === "object" && obj !== null) {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        paths.push(...extractFieldPaths(value, fieldPath, depth + 1));
      } else {
        paths.push(fieldPath);
      }
    }
    return paths;
  }
  return prefix ? [prefix] : [];
}

function buildResearchPlan(
  schema?: Record<string, unknown>,
  columns?: string[],
): string {
  const lines: string[] = [
    "",
    "<research_plan>",
    "The user has defined a schema that serves as your research checklist. You MUST find data for every field before presenting results.",
    "",
  ];

  if (schema) {
    lines.push("Target schema:", "```json", JSON.stringify(schema, null, 2), "```", "");
    const fields = extractFieldPaths(schema);
    if (fields.length > 0) {
      lines.push("Data collection checklist:");
      for (const field of fields) {
        lines.push(`- ${field}`);
      }
      lines.push("");
    }
  }

  if (columns?.length) {
    lines.push("Required columns (each is a data point to collect):");
    for (const col of columns) {
      lines.push(`- ${col}`);
    }
    lines.push("");
  }

  lines.push(
    "Do NOT present results until you have attempted every field. If a field cannot be found after searching, set it to null.",
    "When using spawnAgents, include the relevant fields from this checklist in each worker's prompt.",
    "</research_plan>",
    "",
  );

  return lines.join("\n");
}

// --- Presentation mode builders ---

function buildInlinePresentationMode(): string {
  return `
<presentation_policy>
CRITICAL: NEVER write data inline. No JSON code blocks. No markdown tables. No bullet-point lists of results. No summaries of the extracted data. The user has a viewer panel that shows formatOutput results — writing data in your text response means the user sees it TWICE.

When you have collected all the data, say ONE short sentence (e.g. "Found 10 oil tickers from Yahoo Finance.") and then IMMEDIATELY call formatOutput with format "json". Nothing else.

Do NOT echo, summarize, or preview the data before or after calling formatOutput. The viewer panel handles display.
ALWAYS include a "sources" array in every object with the full URLs you scraped the data from. This is mandatory. Example: "sources": ["https://openai.com/about", "https://crunchbase.com/organization/openai"]
Only use bashExec to SAVE data to /data/ when: (a) the dataset is very large (100+ rows), (b) you need to process it further, or (c) you want to persist intermediate results.
</presentation_policy>`;
}

function buildStructuredPresentationMode(
  schema?: Record<string, unknown>,
  columns?: string[],
): string {
  const lines = [
    "",
    "<presentation_policy>",
    "A schema has been provided. You MUST call formatOutput to deliver the final result.",
    "",
    "Rules:",
    "- Gather ALL data from your research plan before calling formatOutput.",
    "- Match the schema EXACTLY — use null for missing fields, never omit keys.",
    "- Arrays must be arrays even for single items.",
    '- Numbers must be actual numbers, not strings like "$1,000".',
    "- CRITICAL: Do NOT stream the data inline. Do NOT output markdown tables, JSON code blocks, bullet lists, or summaries of the data. The user sees the data in a separate viewer panel. Your text output should be at most one sentence, then call formatOutput.",
    "- You may save intermediate results to /data/ with bashExec as you go, but the FINAL output MUST go through formatOutput.",
    "- Use bashExec with jq to aggregate, transform, or merge data before calling formatOutput if needed.",
    '- ALWAYS include a "sources" array in every object with the full URLs you scraped the data from. This is mandatory even if the schema doesn\'t explicitly include it.',
  ];

  if (schema) {
    lines.push(
      "",
      'When finished, call formatOutput with format "json" and the data matching this schema.',
    );
  } else if (columns?.length) {
    lines.push(
      "",
      `When finished, call formatOutput with format "csv" and columns: ${JSON.stringify(columns)}.`,
    );
  }

  lines.push("</presentation_policy>");

  return lines.join("\n");
}

// --- Orchestrator factory ---

export interface OrchestratorOptions {
  config: AgentConfig;
  firecrawlApiKey: string;
  apiKeys?: Record<string, string>;
  skillsDir?: string;
  maxWorkers?: number;
  workerMaxSteps?: number;
  /** Model used to summarize context when approaching token limits. Defaults to the orchestrator model. */
  compactionModel?: ModelConfig;
}

export async function createOrchestrator(options: OrchestratorOptions) {
  const {
    config,
    firecrawlApiKey,
    apiKeys,
    skillsDir,
    maxWorkers = 6,
    workerMaxSteps = 10,
    compactionModel,
  } = options;

  const model = await resolveModel(config.model, apiKeys);
  const skills = await discoverSkills(skillsDir);

  const { systemPrompt: fcSystemPrompt, ...fcTools } = FirecrawlTools({
    apiKey: firecrawlApiKey,
  });
  const skillTools = createSkillTools(skills, config.skillInstructions);

  // Resolve sub-agent model (falls back to orchestrator model)
  const subAgentModelResolved = config.subAgentModel
    ? await resolveModel(config.subAgentModel, apiKeys)
    : model;

  const subAgentTools = await createSubAgentTools(
    config.subAgents ?? [],
    firecrawlApiKey,
    skills,
    subAgentModelResolved,
    config.skillInstructions,
    apiKeys,
  );

  // --- Build template variables ---

  // Research plan (injected into operating_policy)
  const researchPlan = (config.schema || config.columns)
    ? buildResearchPlan(config.schema, config.columns)
    : "";

  // Workflow steps for operating_policy (app-specific sequence)
  const workflowSteps = `
When handling a request:
1. Determine the task type and what data the user needs.
2. Output a mermaid flowchart showing your plan (see planning_policy below).
3. If URLs are provided, call lookup_site_playbook for site-specific navigation.
4. Execute the plan — search, scrape, paginate, spawn parallel agents as needed.
5. Verify completeness against the schema/checklist before presenting results.
6. Call formatOutput with the collected data. The task is not done until formatOutput is called.`;

  // App-specific sections assembled into one block
  const appSections: string[] = [];

  // Planning policy (mermaid diagrams for the UI)
  appSections.push(`<planning_policy>
IMPORTANT: You MUST output a mermaid flowchart BEFORE making any tool calls for research or data collection tasks. The only exception is simple formatting/export tasks (e.g. "format as JSON") — just do those directly.

\`\`\`mermaid
graph TD
    A[Search for Vercel vs Netlify pricing comparisons] --> B[Scrape vercel.com/pricing — extract all plan tiers]
    A --> C[Scrape netlify.com/pricing — extract all plan tiers]
    B --> D[Compare features across both platforms]
    C --> D
    D --> E[Format as comparison table via formatOutput]
\`\`\`

Rules:
- Always use \`graph TD\` (top-down) layout.
- 5-15 nodes with DESCRIPTIVE labels. Bad: "Extract Data". Good: "Scrape AAPL income statement from Yahoo Finance".
- Include full URLs or specific details in node labels.
- Show parallel branches where applicable — especially when using spawnAgents.
- If your approach changes mid-task (source unavailable, new data discovered), output an UPDATED mermaid diagram with completed steps marked ✓.
</planning_policy>`);

  // Workflow examples
  appSections.push(`<workflow_examples>

Simple query — "Who are the co-founders of Firecrawl?"
1. Search for relevant results.
2. Scrape promising results to extract the answer.
3. Present the answer inline.

Single target research — "I need the founders, funding stage, amount raised, and investors of Firecrawl."
1. Search for relevant URLs.
2. Scrape to extract data. Use spawnAgents if multiple independent sources are needed.
3. Compile and present findings.

Research a list of items — "I need the caloric content of all the foods on this list."
1. Search/scrape to get the list of items.
2. Are all requested details included? If no, use spawnAgents to research each item in parallel.
3. Aggregate results and present.

Find all items on a website — "Get all products from this shop's website."
1. Check sitemaps (sitemap.xml, robots.txt) for an easy route to all pages.
2. Scrape the entry page. Determine: pagination? Categories? Subcategories?
3. For pagination, use interact to click through every page. For categories, scrape each one.
4. If the site is JS-heavy or has infinite scroll, use interact with JavaScript interaction.
5. Use spawnAgents for independent category scraping.
6. Aggregate and present all results.

Comparing multiple targets — "Compare pricing for Vercel, Netlify, and Cloudflare Pages."
1. Use spawnAgents to research each target in parallel.
2. Each agent searches for and scrapes the pricing page independently.
3. Compile results into a comparison.

</workflow_examples>`);

  // Skill policy
  const skillCatalog = skills.length
    ? `\n\nAvailable skills (use load_skill to activate):\n${skills.map((s) => `- ${s.name}: ${s.description.slice(0, 100)}`).join("\n")}`
    : "";

  appSections.push(`<skill_policy>
Do NOT eagerly load skills. Follow this order:

1. First: If the user provides URLs, call lookup_site_playbook with each URL. This returns site-specific navigation (API endpoints, pagination, gotchas). Use whatever it returns — do NOT also load the parent skill.
2. Only if needed: If no site playbook matched, OR the task needs broader domain knowledge beyond site navigation, then load a skill:
   - Company info, contacts, team → company-research
   - E-commerce products, pricing, inventory → e-commerce
   - Financial data, earnings, market metrics → financial-data
   - Pricing comparison across products → price-tracker
   - Single product deep detail, specs, variants → product-extraction
   - Articles, docs, recipes, legal texts → content-extraction
   - Complex schema with nested fields → structured-extraction
   - Multi-source research (3+ sources) → deep-research

Do NOT load a parent skill just to get site navigation — lookup_site_playbook already provides that.
${skillCatalog}
</skill_policy>`);

  // Presentation mode
  const hasStructuredOutput = !!(config.schema || config.columns);
  const presentationMode = hasStructuredOutput
    ? buildStructuredPresentationMode(config.schema, config.columns)
    : buildInlinePresentationMode();
  appSections.push(presentationMode);

  // URL hints
  if (config.urls && config.urls.length > 0) {
    appSections.push(`<user_urls>\nStart with these URLs: ${config.urls.join(", ")}\n</user_urls>`);
  }

  // Pre-seed bash filesystem with uploaded files
  const uploadedFiles: Record<string, string> = {};
  const uploadDescriptions: string[] = [];

  if (config.csvContext) {
    uploadedFiles["/data/input.csv"] = config.csvContext;
    uploadDescriptions.push("/data/input.csv (CSV)");
  }

  if (config.uploads?.length) {
    for (const upload of config.uploads) {
      const isText =
        upload.type.startsWith("text/") ||
        /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(
          upload.name,
        );
      const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `/data/${safeName}`;
      if (isText) {
        uploadedFiles[filePath] = upload.content;
      } else {
        uploadedFiles[filePath + ".b64"] = upload.content;
      }
      uploadDescriptions.push(
        `${filePath} (${upload.type || upload.name.split(".").pop()})`,
      );
    }
  }

  if (Object.keys(uploadedFiles).length > 0) {
    await initBashWithFiles(uploadedFiles);
  }

  // Upload hints
  if (uploadDescriptions.length > 0) {
    appSections.push(`<uploaded_files>\nThe user uploaded files to the bash filesystem:\n${uploadDescriptions.map((d) => `- ${d}`).join("\n")}\nUse bashExec to explore them: 'head -5 /data/file.csv', 'cat /data/file.json | jq .', 'wc -l /data/file.txt', etc.\n</uploaded_files>`);
  }

  const instructions = await loadOrchestratorPrompt({
    TODAY: new Date().toISOString().split("T")[0],
    FIRECRAWL_SYSTEM_PROMPT: fcSystemPrompt ?? "",
    RESEARCH_PLAN: researchPlan,
    WORKFLOW_STEPS: workflowSteps,
    APP_SECTIONS: appSections.join("\n\n"),
  });

  const spawnAgents = createWorkerTool(model, firecrawlApiKey, skills, {
    maxWorkers,
    workerMaxSteps,
  });

  // Context compaction: use provided model or fall back to the orchestrator model
  const resolvedCompactionModel: LanguageModel = compactionModel
    ? await resolveModel(compactionModel, apiKeys)
    : model;
  const compaction = createPrepareStepWithCompaction(
    config.model.model,
    resolvedCompactionModel,
  );

  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      ...fcTools,
      ...skillTools,
      ...subAgentTools,
      spawnAgents,
      formatOutput,
      bashExec,
    },
    stopWhen: stepCountIs(config.maxSteps ?? 20),
    prepareStep: compaction.prepareStep,
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
