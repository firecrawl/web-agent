import express from "express";
import { createAgentFromEnv } from "../../agent-core/src";

const app = express();
app.use(express.json());

app.post("/v1/run", async (req, res) => {
  const { prompt, stream, model, maxSteps, ...rest } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const agent = createAgentFromEnv(model ? { model } : undefined);
  const params = { prompt, maxSteps, ...rest };

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

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`firecrawl-agent listening on http://localhost:${port}`));
