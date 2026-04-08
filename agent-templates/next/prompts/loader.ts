import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cache: Map<string, string> = new Map();

async function load(name: string): Promise<string> {
  if (cache.has(name)) return cache.get(name)!;
  const content = await fs.readFile(path.join(__dirname, name), "utf-8");
  cache.set(name, content.trim());
  return content.trim();
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Load app-specific prompt sections for the Next.js agent UI.
 * These get passed to createAgent({ appSections }) and appended
 * after the core system prompt.
 */
export async function loadAppSections(opts: {
  hasSchema: boolean;
  schema?: Record<string, unknown>;
  columns?: string[];
}): Promise<string[]> {
  const [planning, workflowExamples, presentationInline, presentationSchema] =
    await Promise.all([
      load("planning.md"),
      load("workflow-examples.md"),
      load("presentation-inline.md"),
      load("presentation-schema.md"),
    ]);

  const sections: string[] = [planning, workflowExamples];

  if (opts.hasSchema) {
    let formatInstructions = "";
    if (opts.schema) {
      formatInstructions = `When finished, call formatOutput with format "json" and the data matching this schema.`;
    } else if (opts.columns?.length) {
      formatInstructions = `When finished, call formatOutput with format "csv" and columns: ${JSON.stringify(opts.columns)}.`;
    }
    sections.push(interpolate(presentationSchema, { FORMAT_INSTRUCTIONS: formatInstructions }));
  } else {
    sections.push(presentationInline);
  }

  return sections;
}
