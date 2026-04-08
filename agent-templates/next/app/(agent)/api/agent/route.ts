import { createAgentUIStreamResponse } from "ai";
import { createAgent } from "@/agent-core";
import type { AgentConfig } from "@/agent-core";
import { getFirecrawlKey, getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";
import { config as globalConfig } from "@agent/_config";
import { loadAppSections } from "@/prompts/loader";

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

  try {
    const appSections = await loadAppSections({
      hasSchema: !!(config.schema || config.columns),
      schema: config.schema,
      columns: config.columns,
    });

    const agent = createAgent({
      firecrawlApiKey,
      model: hydrateModelConfig(config.model),
      subAgentModel: config.subAgentModel ? hydrateModelConfig(config.subAgentModel) : undefined,
      apiKeys: getProviderApiKeys(),
      maxSteps: config.maxSteps,
      maxWorkers: globalConfig.maxWorkers,
      workerMaxSteps: globalConfig.workerMaxSteps,
      appSections,
    });

    const orchestrator = await agent.createRawAgent({
      prompt: config.prompt,
      urls: config.urls,
      schema: config.schema,
      columns: config.columns,
      uploads: config.uploads,
      skills: config.skills,
      skillInstructions: config.skillInstructions,
      subAgents: config.subAgents,
    });

    return createAgentUIStreamResponse({
      agent: orchestrator,
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
