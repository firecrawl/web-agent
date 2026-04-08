import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, "prompts");

const cache: Map<string, string> = new Map();

async function loadPromptFile(name: string): Promise<string> {
  if (cache.has(name)) return cache.get(name)!;
  const content = await fs.readFile(path.join(PROMPTS_DIR, name), "utf-8");
  cache.set(name, content.trim());
  return content.trim();
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key) => vars[key] ?? "");
}

export interface OrchestratorPromptVars {
  TODAY: string;
  FIRECRAWL_SYSTEM_PROMPT: string;
  RESEARCH_PLAN: string;
  WORKFLOW_STEPS: string;
  SKILL_CATALOG: string;
  SCHEMA_BLOCK: string;
  FIELD_CHECKLIST: string;
  COLUMNS_BLOCK: string;
}

/**
 * Load and assemble the core system prompt from prompt files.
 * Returns just the core — app-specific sections are appended by the caller.
 */
export async function loadOrchestratorPrompt(
  vars: OrchestratorPromptVars,
  appSections?: string[],
): Promise<string> {
  const [system, researchPlan, skills] = await Promise.all([
    loadPromptFile("system.md"),
    loadPromptFile("research-plan.md"),
    loadPromptFile("skills.md"),
  ]);

  // Core sections
  const sections: string[] = [];

  // Skills policy
  sections.push(interpolate(skills, { SKILL_CATALOG: vars.SKILL_CATALOG }));

  // Research plan (only when schema/columns provided)
  if (vars.SCHEMA_BLOCK || vars.COLUMNS_BLOCK) {
    sections.push(
      interpolate(researchPlan, {
        SCHEMA_BLOCK: vars.SCHEMA_BLOCK,
        FIELD_CHECKLIST: vars.FIELD_CHECKLIST,
        COLUMNS_BLOCK: vars.COLUMNS_BLOCK,
      }),
    );
  }

  // App-specific sections (planning, presentation, workflow examples, etc.)
  if (appSections?.length) {
    sections.push(...appSections);
  }

  // Interpolate the base system template
  const base = interpolate(system, {
    TODAY: vars.TODAY,
    FIRECRAWL_SYSTEM_PROMPT: vars.FIRECRAWL_SYSTEM_PROMPT,
    RESEARCH_PLAN: vars.RESEARCH_PLAN,
    WORKFLOW_STEPS: vars.WORKFLOW_STEPS,
  });

  return base + "\n\n" + sections.join("\n\n");
}
