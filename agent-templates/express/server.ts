import "dotenv/config";
import express from "express";
import { createAgentFromEnv, discoverSkills, workerProgress } from "./agent-core/src";
import type { ModelConfig } from "./agent-core/src";

const app = express();
app.use(express.json());

// CORS — allows frontend apps on other ports/domains to call this API
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function parseModel(m: unknown): ModelConfig | undefined {
  if (!m) return undefined;
  if (typeof m === "object") return m as ModelConfig;
  if (typeof m === "string") {
    const [provider, ...rest] = m.split(":");
    return { provider: provider as ModelConfig["provider"], model: rest.join(":") };
  }
  return undefined;
}

const KEY_LABELS: Record<string, string> = {
  FIRECRAWL_API_KEY: "firecrawl",
  ANTHROPIC_API_KEY: "anthropic",
  OPENAI_API_KEY: "openai",
  GOOGLE_GENERATIVE_AI_API_KEY: "google",
};

function configuredKeys(): string[] {
  return Object.entries(KEY_LABELS)
    .filter(([k]) => process.env[k])
    .map(([, label]) => label);
}

function defaultModel(): string {
  const provider = process.env.MODEL_PROVIDER ?? "google";
  const modelId = process.env.MODEL_ID ?? "gemini-3-flash-preview";
  return `${provider}:${modelId}`;
}

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    model: defaultModel(),
    keys: configuredKeys(),
  });
});

app.get("/v1/skills", async (_req, res) => {
  const skills = await discoverSkills();
  res.json(skills.map((s) => ({ name: s.name, description: s.description, category: s.category })));
});

app.get("/v1/workers/progress", (_req, res) => {
  const progress: Record<string, unknown> = {};
  for (const [id, wp] of workerProgress.entries()) {
    progress[id] = wp;
  }
  res.json(progress);
});

app.post("/v1/run", async (req, res) => {
  const { prompt, stream, model, ...rest } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const modelConfig = parseModel(model);
    const agent = await createAgentFromEnv(modelConfig ? { model: modelConfig } : undefined);
    const params = { prompt, ...rest };

    if (stream) {
      await agent.sse(params, res);
    } else {
      const result = await agent.run(params);
      res.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`\n  firecrawl-agent  http://localhost:${port}  ${defaultModel()}  keys: ${configuredKeys().join(", ")}\n`);
});
