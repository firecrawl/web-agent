import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, "prompt.md");

let cache: string | null = null;

async function loadRaw(): Promise<string> {
  if (cache) return cache;
  const content = await fs.readFile(PROMPT_PATH, "utf-8");
  const parts = content.split("\n---\n");
  const body = parts.length > 1 ? parts[parts.length - 1].trim() : content.trim();
  cache = body;
  return body;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key) => vars[key] ?? "");
}

export async function loadWorkerPrompt(vars: { TASK_ID: string }): Promise<string> {
  const template = await loadRaw();
  return interpolate(template, vars);
}
