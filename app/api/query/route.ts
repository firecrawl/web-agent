import { ToolLoopAgent, stepCountIs } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import { resolveModel, formatOutput, bashExec, createSkillTools, discoverSkills } from "@agent-core";
import { getTaskModel } from "@/config";
import { getFirecrawlKey, getProviderKey } from "@/lib/config/keys";

export const maxDuration = 300;

const DEFAULT_MAX_STEPS = 15;
const MAX_STEPS_LIMIT = 50;

/**
 * POST /api/query
 *
 * Simple API endpoint for programmatic use.
 *
 * Request body:
 *   {
 *     "prompt": "get firecrawl pricing",
 *     "model": "claude-sonnet-4-6",          // optional, default claude-sonnet-4-6
 *     "provider": "anthropic",               // optional, default anthropic
 *     "urls": ["https://..."],               // optional, seed URLs
 *     "schema": { ... },                     // optional, JSON schema for output
 *     "maxSteps": 15,                        // optional, default 15
 *     "stream": false                        // optional, default false
 *   }
 *
 * Response (stream=false):
 *   { "text": "...", "steps": [...], "usage": { ... } }
 *
 * Response (stream=true):
 *   SSE stream with events:
 *     data: {"type":"text","content":"..."}
 *     data: {"type":"tool-call","name":"search","args":{...}}
 *     data: {"type":"tool-result","name":"search","result":{...}}
 *     data: {"type":"done","text":"...","usage":{...}}
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    prompt,
    model: modelId,
    provider,
    urls,
    schema,
    maxSteps: rawMaxSteps,
    stream = false,
  } = body as {
    prompt: string;
    model?: string;
    provider?: string;
    urls?: string[];
    schema?: Record<string, unknown>;
    maxSteps?: number;
    stream?: boolean;
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
    const apiKeys: Record<string, string> = {};
    for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
      const k = getProviderKey(p);
      if (k) apiKeys[p] = k;
    }

    const queryDefault = getTaskModel("query");
    const model = await resolveModel({
      provider: (provider ?? queryDefault.provider) as "anthropic" | "openai" | "google" | "gateway",
      model: modelId ?? queryDefault.model,
    }, apiKeys);

    const { systemPrompt: fcSystemPrompt, ...fcTools } = FirecrawlTools({
      apiKey: firecrawlApiKey,
    });

    const skills = await discoverSkills();
    const skillTools = createSkillTools(skills);

    const schemaHint = schema
      ? `\n\nStructure your output to match this JSON schema:\n${JSON.stringify(schema, null, 2)}\nCall formatOutput with format "json" when done.`
      : "";

    const urlHint = urls?.length
      ? `\n\nStart with these URLs: ${urls.join(", ")}`
      : "";

    const system = `You are a web research agent powered by Firecrawl. Gather data from the web using search, scrape, and interact tools. Be thorough and narrate what you're doing.\n\n${fcSystemPrompt ?? ""}${schemaHint}${urlHint}`;

    const tools = {
      ...fcTools,
      ...skillTools,
      formatOutput,
      bashExec,
    };

    const createAgent = () =>
      new ToolLoopAgent({
        model,
        instructions: system,
        tools,
        stopWhen: stepCountIs(maxSteps),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapStep = (s: any) => ({
      text: s.text ?? "",
      toolCalls: (s.toolCalls ?? []).filter(Boolean).map((tc: Record<string, unknown>) => ({
        name: tc.toolName ?? "",
        input: tc.input ?? tc.args,
      })),
      toolResults: (s.toolResults ?? []).filter(Boolean).map((tr: Record<string, unknown>) => ({
        name: tr.toolName ?? "",
        output: tr.output ?? tr.result,
      })),
    });

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            const agent = createAgent();
            const result = await agent.generate({
              prompt,
              onStepFinish: ({ text: stepText, toolCalls, toolResults, usage: stepUsage }) => {
                if (stepText) {
                  send({ type: "text", content: stepText });
                }
                if (toolCalls) {
                  for (const tc of toolCalls ?? []) {
                    if (!tc) continue;
                    const c = tc as Record<string, unknown>;
                    send({ type: "tool-call", name: c.toolName, input: c.input ?? c.args });
                  }
                }
                if (toolResults) {
                  for (const tr of toolResults ?? []) {
                    if (!tr) continue;
                    const r = tr as Record<string, unknown>;
                    send({ type: "tool-result", name: r.toolName, output: r.output ?? r.result });
                  }
                }
                if (stepUsage) {
                  send({ type: "usage", usage: stepUsage });
                }
              },
            });

            send({
              type: "done",
              text: result.text ?? "",
              steps: (result.steps ?? []).map(mapStep),
              usage: result.usage,
            });
          } catch (err) {
            send({ type: "error", error: err instanceof Error ? err.message : String(err) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: run to completion
    const agent = createAgent();
    const result = await agent.generate({ prompt });

    return Response.json({
      text: result.text ?? "",
      steps: (result.steps ?? []).map(mapStep),
      usage: result.usage,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
