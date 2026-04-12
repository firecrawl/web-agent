import { generateText, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { resolveModel, formatOutput, bashExec, createSkillTools, discoverSkills, buildFirecrawlToolkit } from "@/agent-core";
import { getTaskModel } from "@agent/_config";
import { getFirecrawlKey, getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";
import type { ModelConfig } from "@/agent-core";

export const maxDuration = 300;

const DEFAULT_MAX_STEPS = 50;
const MAX_STEPS_LIMIT = 200;

/**
 * POST /api/extract
 *
 * Extract data from the web and return it in a specific format.
 *
 * Request:
 *   {
 *     "prompt": "get pricing for Vercel and Netlify",
 *     "format": "json",                           // "json" | "csv" | "markdown" | "html"
 *     "schema": { ... },                          // optional, JSON schema (for json format)
 *     "columns": ["name", "price", "features"],   // optional, column names (for csv format)
 *     "urls": ["https://..."],                     // optional, seed URLs
 *     "model": "claude-sonnet-4-6",               // optional
 *     "provider": "anthropic",                    // optional
 *     "maxSteps": 15                              // optional
 *   }
 *
 * Response:
 *   {
 *     "format": "json" | "csv" | "markdown" | "html",
 *     "data": "...",           // the formatted output string
 *     "text": "...",           // agent's narrative text
 *     "usage": { ... }
 *   }
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    prompt,
    format = "json",
    schema,
    columns,
    urls,
    model: modelId,
    provider,
    maxSteps: rawMaxSteps,
  } = body as {
    prompt: string;
    format?: "json" | "csv" | "markdown" | "html";
    schema?: Record<string, unknown>;
    columns?: string[];
    urls?: string[];
    model?: string;
    provider?: string;
    maxSteps?: number;
  };

  const maxSteps = Math.min(Math.max(1, rawMaxSteps ?? DEFAULT_MAX_STEPS), MAX_STEPS_LIMIT);

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const firecrawlApiKey = getFirecrawlKey();
  if (!firecrawlApiKey) {
    return Response.json({ error: "FIRECRAWL_API_KEY is not configured. Add it in Settings." }, { status: 500 });
  }

  try {
    const extractDefault = getTaskModel("extract");
    const apiKeys = getProviderApiKeys();

    const model = await resolveModel(hydrateModelConfig({
      provider: (provider ?? extractDefault.provider) as ModelConfig["provider"],
      model: modelId ?? extractDefault.model,
    }), apiKeys);

    const toolkit = buildFirecrawlToolkit(firecrawlApiKey);

    const skills = await discoverSkills();
    const skillTools = createSkillTools(skills);

    // Build format-specific instructions
    let formatInstructions = "";
    const toolFormat = format === "markdown" || format === "html" ? "text" : format;

    if (format === "json" && schema) {
      formatInstructions = `\n\nReturn the data as JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nWhen done gathering data, call formatOutput with format "json" and the structured data.`;
    } else if (format === "json") {
      formatInstructions = `\n\nReturn the data as structured JSON. When done gathering data, call formatOutput with format "json" and the data as a well-structured JSON object or array.`;
    } else if (format === "csv" && columns?.length) {
      formatInstructions = `\n\nReturn the data as CSV with these columns: ${columns.join(", ")}\n\nWhen done gathering data, call formatOutput with format "csv", the data as an array of objects, and columns: ${JSON.stringify(columns)}.`;
    } else if (format === "csv") {
      formatInstructions = `\n\nReturn the data as CSV. When done gathering data, call formatOutput with format "csv" and the data as an array of objects. Choose appropriate column names.`;
    } else if (format === "markdown") {
      formatInstructions = `\n\nReturn the data as a clean, well-structured markdown report. Use headings, tables, and lists as appropriate. When done, call formatOutput with format "text" and the markdown content.`;
    } else if (format === "html") {
      formatInstructions = `\n\nReturn the data as a clean HTML document with inline styles, proper tables, and good typography. When done, call formatOutput with format "text" and the HTML content.`;
    }

    const urlHint = urls?.length ? `\n\nStart with these URLs: ${urls.join(", ")}` : "";

    const system = `You are a web research agent powered by Firecrawl. Gather data from the web, then format and return it exactly as instructed. Be thorough but concise. Never use emojis.\n\n${toolkit.systemPrompt ?? ""}${formatInstructions}${urlHint}`;

    const tools = {
      ...toolkit.tools,
      ...skillTools,
      formatOutput,
      bashExec,
    } as ToolSet;

    const agent = new ToolLoopAgent({
      model,
      instructions: system,
      tools,
      stopWhen: stepCountIs(maxSteps),
    });

    const { text, steps, usage } = await generateText({
      model: agent as unknown as Parameters<typeof generateText>[0]["model"],
      prompt,
    });

    // Extract formatted output from the last formatOutput tool call
    let formattedData: string | null = null;
    let detectedFormat = format;

    for (const step of [...steps].reverse()) {
      for (const result of step.toolResults) {
        const r = result as Record<string, unknown>;
        if (r.toolName === "formatOutput") {
          const output = (r.output ?? r.result) as { format?: string; content?: string } | undefined;
          if (output?.content) {
            formattedData = output.content;
            if (output.format === "json") detectedFormat = "json";
            else if (output.format === "csv") detectedFormat = "csv";
            else detectedFormat = format;
            break;
          }
        }
      }
      if (formattedData) break;
    }

    return Response.json({
      format: detectedFormat,
      data: formattedData ?? text,
      text,
      usage,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
