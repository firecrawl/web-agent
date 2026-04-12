import { ToolLoopAgent, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import type { AgentConfig, ModelConfig, Toolkit } from "../types";
import { resolveModel } from "../resolve-model";
import { createSkillTools } from "../skills/tools";
import { createSubAgentTools } from "./sub-agents";
import { createWorkerTool } from "../worker";
import { formatOutput, bashExec, initBashWithFiles, createExportSkillTool } from "../tools";
import { discoverSkills } from "../skills/discovery";
import { loadOrchestratorPrompt, loadPromptFile } from "./loader";
import { createPrepareStepWithCompaction } from "./compaction";

// --- Helpers ---

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

function buildSchemaBlock(schema?: Record<string, unknown>): string {
  if (!schema) return "";
  return `<required_schema>
CRITICAL: You MUST populate EXACTLY these fields and ONLY these fields. Do not add extra fields. Do not omit fields. Every field below must have a value scraped from a real source.
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`
</required_schema>`;
}

function buildFieldChecklist(schema?: Record<string, unknown>): string {
  if (!schema) return "";
  const fields = extractFieldPaths(schema);
  if (fields.length === 0) return "";
  return `<field_checklist>
Before calling formatOutput, verify EVERY field below is populated. If a field is missing, go back and scrape for it. Do not submit partial data.
${fields.map((f) => `- [ ] ${f}`).join("\n")}
</field_checklist>`;
}

function buildColumnsBlock(columns?: string[]): string {
  if (!columns?.length) return "";
  return `Required columns (each is a data point to collect):\n${columns.map((c) => `- ${c}`).join("\n")}`;
}

function buildFormatInstructions(schema?: Record<string, unknown>, columns?: string[]): string {
  if (schema) {
    return `When finished, call formatOutput with format "json" and data that EXACTLY matches the required_schema. Every field must be present. No extra fields.`;
  }
  if (columns?.length) {
    return `When finished, call formatOutput with format "csv" and columns: ${JSON.stringify(columns)}.`;
  }
  return "";
}

// --- Orchestrator factory ---

export interface OrchestratorOptions {
  config: AgentConfig;
  toolkit: Toolkit;
  apiKeys?: Record<string, string>;
  skillsDir?: string;
  maxWorkers?: number;
  workerMaxSteps?: number;
  compactionModel?: ModelConfig;
  /** App-specific prompt sections appended after the core system prompt */
  appSections?: string[];
}

export async function createOrchestrator(options: OrchestratorOptions) {
  const {
    config,
    toolkit,
    apiKeys,
    skillsDir,
    maxWorkers = 6,
    workerMaxSteps = 10,
    compactionModel,
  } = options;

  // 1. Resolve models
  const model = await resolveModel(config.model, apiKeys);
  const subAgentModel = config.subAgentModel
    ? await resolveModel(config.subAgentModel, apiKeys)
    : model;

  // 2. Discover skills
  const skills = await discoverSkills(skillsDir);

  // 3. Build tools
  const skillTools = createSkillTools(skills, config.skillInstructions);
  const subAgentTools = await createSubAgentTools(
    config.subAgents ?? [],
    toolkit,
    skills,
    subAgentModel,
    config.skillInstructions,
    apiKeys,
    { maxWorkers, workerMaxSteps },
  );
  const spawnAgents = createWorkerTool(model, toolkit, skills, {
    maxWorkers,
    workerMaxSteps,
  });
  const exportSkill = createExportSkillTool(skillsDir);

  // 4. Pre-seed bash filesystem with uploads
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
        /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(upload.name);
      const safeName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `/data/${safeName}`;
      uploadedFiles[isText ? filePath : filePath + ".b64"] = upload.content;
      uploadDescriptions.push(`${filePath} (${upload.type || upload.name.split(".").pop()})`);
    }
  }

  if (Object.keys(uploadedFiles).length > 0) {
    await initBashWithFiles(uploadedFiles);
  }

  // 5. Load and assemble prompt from prompt files
  const hasStructuredOutput = !!(config.schema || config.columns);
  const skillCatalog = skills.length
    ? `\n\nAvailable skills (use load_skill to activate):\n${skills.map((s) => `- ${s.name}: ${s.description.slice(0, 100)}`).join("\n")}`
    : "";

  // Context hints (URLs, uploads) — these are core because they're data, not policy
  const contextSections: string[] = [];
  if (config.urls?.length) {
    contextSections.push(`<user_urls>\nStart with these URLs: ${config.urls.join(", ")}\n</user_urls>`);
  }
  if (uploadDescriptions.length > 0) {
    contextSections.push(`<uploaded_files>\nThe user uploaded files to the bash filesystem:\n${uploadDescriptions.map((d) => `- ${d}`).join("\n")}\nUse bashExec to explore them: 'head -5 /data/file.csv', 'cat /data/file.json | jq .', 'wc -l /data/file.txt', etc.\n</uploaded_files>`);
  }

  // Export skill prompt (loaded when agent should save its procedure)
  if (config.exportSkill) {
    const exportPrompt = await loadPromptFile("export-skill.md");
    contextSections.push(exportPrompt);
  }

  const instructions = await loadOrchestratorPrompt(
    {
      TODAY: new Date().toISOString().split("T")[0],
      FIRECRAWL_SYSTEM_PROMPT: toolkit.systemPrompt ?? "",
      RESEARCH_PLAN: hasStructuredOutput
        ? `\n${buildSchemaBlock(config.schema)}\n${buildFieldChecklist(config.schema)}\n${buildColumnsBlock(config.columns)}`
        : "",
      WORKFLOW_STEPS: `
When handling a request:
1. Determine the task type and what data the user needs.
2. If URLs are provided, call lookup_site_playbook for site-specific navigation.
3. Execute — search, scrape, paginate; use spawnAgents only when many independent targets clearly warrant parallel fan-out.
4. Verify completeness against the schema/checklist before presenting results.
5. Call formatOutput with the collected data. The task is not done until formatOutput is called.`,
      SKILL_CATALOG: skillCatalog,
      SCHEMA_BLOCK: buildSchemaBlock(config.schema),
      FIELD_CHECKLIST: buildFieldChecklist(config.schema),
      COLUMNS_BLOCK: buildColumnsBlock(config.columns),
    },
    [...contextSections, ...(options.appSections ?? [])],
  );

  // 6. Context compaction
  const resolvedCompactionModel: LanguageModel = compactionModel
    ? await resolveModel(compactionModel, apiKeys)
    : model;
  const compaction = createPrepareStepWithCompaction(
    config.model.model,
    resolvedCompactionModel,
  );

  // 7. Create the AI SDK ToolLoopAgent
  return new ToolLoopAgent({
    model,
    instructions,
    tools: {
      ...toolkit.tools,
      ...skillTools,
      ...subAgentTools,
      spawnAgents,
      formatOutput,
      bashExec,
      exportSkill,
    } as ToolSet,
    stopWhen: stepCountIs(config.maxSteps ?? 50),
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
