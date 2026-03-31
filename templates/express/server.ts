import express from "express";
import { createAgent, discoverSkills } from "../../agent-core/src";
import type { RunParams, ModelConfig } from "../../agent-core/src";

const app = express();
app.use(express.json());

const DEFAULT_MAX_STEPS = 15;
const MAX_STEPS_LIMIT = 50;

function getApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  if (process.env.ANTHROPIC_API_KEY) keys.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) keys.openai = process.env.OPENAI_API_KEY;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) keys.google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return keys;
}

app.post("/v1/run", async (req, res) => {
  const { prompt, stream = false, format, schema, columns, urls, model, subAgentModel, maxSteps: rawMaxSteps, skills } = req.body;

  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) return res.status(500).json({ error: "FIRECRAWL_API_KEY is not configured" });

  const maxSteps = Math.min(Math.max(1, rawMaxSteps ?? DEFAULT_MAX_STEPS), MAX_STEPS_LIMIT);

  const agent = createAgent({
    firecrawlApiKey,
    model: model ?? { provider: "google", model: "gemini-2.5-flash-preview-05-20" } as ModelConfig,
    subAgentModel,
    apiKeys: getApiKeys(),
    maxSteps,
  });

  const runParams: RunParams = { prompt, urls, schema, format, columns, skills };

  try {
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      for await (const event of agent.stream(runParams)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    } else {
      const result = await agent.run(runParams);
      res.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: message });
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

app.get("/v1/skills", async (_req, res) => {
  const skills = await discoverSkills();
  res.json(skills.map((s) => ({ name: s.name, description: s.description, category: s.category ?? "Other", resources: s.resources })));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`firecrawl-agent listening on http://localhost:${port}`));
