import { createAgent } from "@agent-core";
import { getFirecrawlKey, getProviderKey } from "@/lib/config/keys";
import { config as globalConfig, getTaskModel } from "@/config";
import type { RunParams, ModelConfig } from "@agent-core";

export const maxDuration = 300;

const DEFAULT_MAX_STEPS = 15;
const MAX_STEPS_LIMIT = 50;

/**
 * POST /api/v1/run
 *
 * Consolidated endpoint for all agent operations.
 * Replaces /api/query and /api/extract with a single interface.
 *
 * See agent-core/openapi.yaml for the full spec.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    prompt,
    stream = false,
    format,
    schema,
    columns,
    urls,
    model: modelOverride,
    subAgentModel: subAgentModelOverride,
    maxSteps: rawMaxSteps,
    skills,
  } = body as {
    prompt: string;
    stream?: boolean;
    format?: "json" | "csv" | "markdown";
    schema?: Record<string, unknown>;
    columns?: string[];
    urls?: string[];
    model?: ModelConfig;
    subAgentModel?: ModelConfig;
    maxSteps?: number;
    skills?: string[];
  };

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const firecrawlApiKey = getFirecrawlKey();
  if (!firecrawlApiKey) {
    return Response.json(
      { error: "FIRECRAWL_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const maxSteps = Math.min(
    Math.max(1, rawMaxSteps ?? DEFAULT_MAX_STEPS),
    MAX_STEPS_LIMIT,
  );

  const queryDefault = getTaskModel("query");
  const model = modelOverride ?? {
    provider: queryDefault.provider,
    model: queryDefault.model,
  };

  const apiKeys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) apiKeys[p] = k;
  }

  const agent = createAgent({
    firecrawlApiKey,
    model: model as ModelConfig,
    subAgentModel: subAgentModelOverride as ModelConfig | undefined,
    apiKeys,
    maxSteps,
    maxWorkers: globalConfig.maxWorkers,
    workerMaxSteps: globalConfig.workerMaxSteps,
  });

  const runParams: RunParams = {
    prompt,
    urls,
    schema,
    format,
    columns,
    skills,
  };

  try {
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
          };
          try {
            for await (const event of agent.stream(runParams)) {
              send(event as unknown as Record<string, unknown>);
            }
          } catch (err) {
            send({
              type: "error",
              error: err instanceof Error ? err.message : String(err),
            });
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

    // Non-streaming
    const result = await agent.run(runParams);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
