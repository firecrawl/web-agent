import { createAgent } from "@/agent-core";
import { getFirecrawlKey, getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";
import { config as globalConfig, getTaskModel } from "@agent/_config";
import type { RunParams, ModelConfig } from "@/agent-core";
import { loadAppSections } from "@/prompts/loader";

// Vercel: requires Pro plan. Free tier caps at 10s, Hobby at 60s.
// Other platforms (Railway, Fly, self-hosted) ignore this export.
export const maxDuration = 300;

const DEFAULT_MAX_STEPS = 50;
const MAX_STEPS_LIMIT = 200;

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
    model: modelOverride,
    subAgentModel: subAgentModelOverride,
    maxSteps: rawMaxSteps,
    ...rest
  } = body as RunParams & {
    stream?: boolean;
    model?: ModelConfig;
    subAgentModel?: ModelConfig;
    maxSteps?: number;
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
  const model = hydrateModelConfig(modelOverride ?? {
    provider: queryDefault.provider,
    model: queryDefault.model,
  });

  const apiKeys = getProviderApiKeys();

  const appSections = await loadAppSections({
    hasSchema: !!(rest.schema || rest.columns),
    schema: rest.schema as Record<string, unknown> | undefined,
    columns: rest.columns,
  });

  const agent = createAgent({
    firecrawlApiKey,
    model: model as ModelConfig,
    subAgentModel: subAgentModelOverride ? hydrateModelConfig(subAgentModelOverride as ModelConfig) : undefined,
    apiKeys,
    maxSteps,
    maxWorkers: globalConfig.maxWorkers,
    workerMaxSteps: globalConfig.workerMaxSteps,
    appSections,
  });

  const runParams: RunParams = {
    prompt,
    ...rest,
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
