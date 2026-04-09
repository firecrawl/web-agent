import "dotenv/config";
import express from "express";
import { createAgent, createAgentFromEnv, uploadSkills, getDefaultSkillsDir } from "./agent-core/src";
import type { ModelConfig } from "./agent-core/src";

const app = express();
app.use(express.json());

// --- API endpoint (same interface as the Next.js template) ---

app.post("/v1/run", async (req, res) => {
  const { prompt, stream, model, subAgentModel, maxSteps, ...rest } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const overrides: Record<string, unknown> = {};
  if (model) overrides.model = model;
  if (subAgentModel) overrides.subAgentModel = subAgentModel;

  const agent = createAgentFromEnv(Object.keys(overrides).length ? overrides : undefined);
  const clampedMaxSteps = maxSteps ? Math.min(Math.max(1, maxSteps), 200) : undefined;
  const params = { prompt, maxSteps: clampedMaxSteps, ...rest };

  try {
    if (stream) {
      await agent.sse(params, res);
    } else {
      res.json(await agent.run(params));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(500).json({ error: message });
  }
});

// --- Skill upload ---

app.post("/v1/skills/upload", async (req, res) => {
  const { files, overwrite } = req.body;

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "No files provided" });
  }
  if (files.length > 20) {
    return res.status(400).json({ error: "Maximum 20 files per upload" });
  }

  const results = await uploadSkills(files, getDefaultSkillsDir(), overwrite ?? false);
  res.json({ results });
});

// --- Start ---

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  const provider = process.env.MODEL_PROVIDER ?? "google";
  const model = process.env.MODEL_ID ?? "gemini-3-flash-preview";
  const keys = ["FIRECRAWL_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"]
    .filter((k) => process.env[k])
    .map((k) => k.replace(/_API_KEY|_GENERATIVE_AI_API_KEY/, "").toLowerCase());
  console.log(`\n  firecrawl-agent  http://localhost:${port}  ${provider}/${model}  keys: ${keys.join(", ")}\n`);
});
