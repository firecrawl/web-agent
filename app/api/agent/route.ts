import { createAgentUIStreamResponse } from "ai";
import { createOrchestrator, type OrchestratorOptions } from "@agent-core";
import type { AgentConfig } from "@agent-core";
import { getFirecrawlKey, getProviderKey } from "@/lib/config/keys";
import { config as globalConfig } from "@/config";
import { buildFirecrawlToolkit } from "@/lib/toolkit";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, config } = (await req.json()) as {
    messages: unknown[];
    config: AgentConfig;
  };

  const firecrawlApiKey = getFirecrawlKey();
  if (!firecrawlApiKey) {
    return new Response(
      JSON.stringify({ error: "FIRECRAWL_API_KEY is not configured. Add it in Settings." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKeys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) apiKeys[p] = k;
  }

  try {
    const toolkit = buildFirecrawlToolkit(firecrawlApiKey);

    const opts: OrchestratorOptions = {
      config,
      toolkit,
      apiKeys,
      maxWorkers: globalConfig.maxWorkers,
      workerMaxSteps: globalConfig.workerMaxSteps,
    };

    const agent = await createOrchestrator(opts);

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages as Parameters<
        typeof createAgentUIStreamResponse
      >[0]["uiMessages"],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
