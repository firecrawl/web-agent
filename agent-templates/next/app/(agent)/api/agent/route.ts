import { createAgentUIStreamResponse, type UIMessage } from "ai";
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
      JSON.stringify({
        error:
          "FIRECRAWL_API_KEY is missing. Set it in .env.local (or your host’s env), or paste it in Settings — then restart dev if you edited the file.",
      }),
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

    const uiMessages = messages as UIMessage[];
    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No messages in request. The chat UI must send at least one user message.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Must forward client messages: AI SDK validateUIMessages requires a non-empty array.
    // Omitting them caused AI_TypeValidationError and an empty 500 body (generic client error).
    return await createAgentUIStreamResponse({
      // ToolLoopAgent concrete tool map is incompatible with Agent's default generics in strict mode
      agent: orchestrator as Parameters<typeof createAgentUIStreamResponse>[0]["agent"],
      uiMessages,
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
