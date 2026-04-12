import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, "prompts", "system.md");

let cache: string | null = null;

async function loadRaw(): Promise<string> {
  if (cache) return cache;
  cache = (await fs.readFile(PROMPT_PATH, "utf-8")).trim();
  return cache;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key) => vars[key] ?? "");
}

export async function loadWorkerPrompt(vars: { TASK_ID: string }): Promise<string> {
  const template = await loadRaw();
  return interpolate(template, vars);
}
