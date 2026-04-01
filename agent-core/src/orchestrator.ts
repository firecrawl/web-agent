import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { AgentConfig, ModelConfig } from "./types";
import { resolveModel } from "./resolve-model";
import { createSkillTools } from "./skills/tools";
import { createSubAgentTools } from "./sub-agents";
import { createWorkerTool } from "./workers";
import { formatOutput, bashExec, initBashWithFiles } from "./tools";
import { discoverSkills } from "./skills/discovery";
import { loadOrchestratorPrompt } from "./prompts/loader";
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
    "## Research plan -- required data fields",
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
    "",
  );

  return lines.join("\n");
}

// --- Presentation mode builders ---

function buildInlinePresentationMode(): string {
  return `
## Presenting results — ALWAYS use formatOutput
- CRITICAL: NEVER write data inline. No JSON code blocks. No markdown tables. No bullet-point lists of results. No summaries of the extracted data. The user has a viewer panel that shows formatOutput results — writing data in your text response means the user sees it TWICE.
- When you have collected all the data, say ONE short sentence (e.g. "Found 10 oil tickers from Yahoo Finance.") and then IMMEDIATELY call formatOutput with format "json". Nothing else.
- Do NOT echo, summarize, or preview the data before or after calling formatOutput. The viewer panel handles display.
- ALWAYS include a "sources" array in every object with the full URLs you scraped the data from. This is mandatory, not optional. Example: "sources": ["https://openai.com/about", "https://crunchbase.com/organization/openai"]
- Only use bashExec to SAVE data to /data/ when: (a) the dataset is very large (100+ rows), (b) you need to process it further, or (c) you want to persist intermediate results between steps.`;
}

function buildStructuredPresentationMode(
  schema?: Record<string, unknown>,
  columns?: string[],
): string {
  const lines = [
    "",
    "## Presenting results — STRUCTURED OUTPUT (MANDATORY)",
    "A schema has been provided. You MUST call formatOutput to deliver the final result. This is not optional.",
    "",
    "Rules:",
    "- Gather ALL data from your research plan before calling formatOutput.",
    "- Match the schema EXACTLY — use null for missing fields, never omit keys.",
    "- Arrays must be arrays even for single items.",
    "- Numbers must be actual numbers, not strings like \"$1,000\".",
    "- CRITICAL: Do NOT stream the data inline. Do NOT output markdown tables, JSON code blocks, bullet lists, or summaries of the data. The user sees the data in a separate viewer panel. Your text output should be at most one sentence, then call formatOutput.",
    "- You may save intermediate results to /data/ with bashExec as you go, but the FINAL output MUST go through formatOutput.",
    "- Use bashExec with jq to aggregate, transform, or merge data before calling formatOutput if needed.",
    '- ALWAYS include a "sources" array in every object with the full URLs you scraped the data from. This is mandatory even if the schema doesn\'t explicitly include it.',
  ];

  if (schema) {
    lines.push(
      "",
      "When finished, call formatOutput with format \"json\" and the data matching this schema.",
    );
  } else if (columns?.length) {
    lines.push(
      "",
      `When finished, call formatOutput with format "csv" and columns: ${JSON.stringify(columns)}.`,
    );
  }

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

  // Skill catalog for system prompt
  const skillCatalog = skills.length
    ? `\n\nAvailable skills (use load_skill to activate):\n${skills.map((s) => `- ${s.name}: ${s.description.slice(0, 100)}`).join("\n")}`
    : "";

  // Research plan (early in prompt — guides data collection)
  const researchPlan = (config.schema || config.columns)
    ? buildResearchPlan(config.schema, config.columns)
    : "";

  // Presentation mode: structured output (schema provided) vs inline streaming (chat UI)
  const hasStructuredOutput = !!(config.schema || config.columns);

  const presentationMode = hasStructuredOutput
    ? buildStructuredPresentationMode(config.schema, config.columns)
    : buildInlinePresentationMode();

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

  const uploadHint =
    uploadDescriptions.length > 0
      ? `\n\nThe user uploaded files to the bash filesystem:\n${uploadDescriptions.map((d) => `- ${d}`).join("\n")}\nUse bashExec to explore them: 'head -5 /data/file.csv', 'cat /data/file.json | jq .', 'wc -l /data/file.txt', etc.`
      : "";

  const instructions = await loadOrchestratorPrompt({
    TODAY: new Date().toISOString().split("T")[0],
    FIRECRAWL_SYSTEM_PROMPT: fcSystemPrompt ?? "",
    SKILL_CATALOG: skillCatalog,
    RESEARCH_PLAN: researchPlan,
    PRESENTATION_MODE: presentationMode,
    URL_HINTS: urlHint,
    UPLOAD_HINTS: uploadHint,
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
