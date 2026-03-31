import fs from "fs/promises";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const cache = new Map<string, string>();

async function loadRaw(file: string): Promise<string> {
  const key = file;
  if (cache.has(key)) return cache.get(key)!;
  const content = await fs.readFile(path.join(PROMPTS_DIR, file), "utf-8");
  // Strip everything before the last "---" separator (metadata/frontmatter)
  const parts = content.split("\n---\n");
  const body = parts.length > 1 ? parts[parts.length - 1].trim() : content.trim();
  cache.set(key, body);
  return body;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key) => vars[key] ?? "");
}

export async function loadOrchestratorPrompt(vars: {
  TODAY: string;
  FIRECRAWL_SYSTEM_PROMPT: string;
  SKILL_CATALOG: string;
  SCHEMA_HINT: string;
  URL_HINTS: string;
  UPLOAD_HINTS: string;
}): Promise<string> {
  const template = await loadRaw("orchestrator.md");
  return interpolate(template, vars);
}

export async function loadWorkerPrompt(vars: { TASK_ID: string }): Promise<string> {
  const template = await loadRaw("worker.md");
  return interpolate(template, vars);
}
