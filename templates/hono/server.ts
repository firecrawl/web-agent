import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import { createAgent, discoverSkills } from "../../agent-core/src";
import type { ModelConfig, RunParams } from "../../agent-core/src";

const app = new Hono();

// --- helpers ---

function envModel(): ModelConfig {
  const provider = (process.env.MODEL_PROVIDER ?? "google") as ModelConfig["provider"];
  const model = process.env.MODEL_ID ?? "gemini-2.5-flash-preview-05-20";
  return { provider, model };
}

function apiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  const map: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_KEY",
    gateway: "GATEWAY_API_KEY",
  };
  for (const [k, env] of Object.entries(map)) {
    if (process.env[env]) keys[k] = process.env[env]!;
  }
  return keys;
}

// --- routes ---

app.post("/v1/run", async (c) => {
  const body = await c.req.json();
  const { prompt, stream = false, format, schema, columns, urls, model, maxSteps, skills } = body;

  if (!prompt) return c.json({ error: "prompt is required" }, 400);

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) return c.json({ error: "FIRECRAWL_API_KEY not set" }, 500);

  const agent = createAgent({
    firecrawlApiKey,
    model: model ?? envModel(),
    apiKeys: apiKeys(),
    maxSteps: Math.min(Math.max(1, maxSteps ?? 15), 50),
  });

  const runParams: RunParams = { prompt, urls, schema, format, columns, skills };

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        for await (const event of agent.stream(runParams)) {
          await sseStream.writeSSE({ data: JSON.stringify(event) });
        }
      } catch (err) {
        await sseStream.writeSSE({
          data: JSON.stringify({ type: "error", error: err instanceof Error ? err.message : String(err) }),
        });
      }
    });
  }

  try {
    const result = await agent.run(runParams);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

app.get("/v1/skills", async (c) => {
  const skills = await discoverSkills();
  return c.json(
    skills.map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category ?? "Other",
      resources: s.resources,
    })),
  );
});

// --- start ---

const port = Number(process.env.PORT ?? 3000);
console.log(`firecrawl-agent listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
