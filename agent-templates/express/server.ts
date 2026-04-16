import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { createAgentFromEnv, discoverSkills, workerProgress } from "./agent-core/src";
import type { ModelConfig } from "./agent-core/src";

const app = express();

// 1 MB default body limit — agent requests are small (prompt + config),
// bigger = probably a mistake or abuse. Override with BODY_LIMIT env var.
app.use(express.json({ limit: process.env.BODY_LIMIT ?? "1mb" }));

// CORS — allows frontend apps on other ports/domains to call this API
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
  res.header("Access-Control-Expose-Headers", "X-Request-ID");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Request ID — echo the client's X-Request-ID if provided, otherwise
// generate one. Makes support/debugging across distributed systems easier.
app.use((req, res, next) => {
  const id = (req.header("X-Request-ID") as string | undefined) ?? randomUUID();
  res.setHeader("X-Request-ID", id);
  (req as express.Request & { id: string }).id = id;
  next();
});

// Request logger — prints method, path, status, duration, request ID.
// Disable with LOG=0.
if (process.env.LOG !== "0") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const id = (req as express.Request & { id?: string }).id ?? "-";
      console.log(`  ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms  ${id}`);
    });
    next();
  });
}

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
  // MODEL="provider:id" shorthand takes precedence, falling back to the
  // split MODEL_PROVIDER + MODEL_ID pair, then to google:gemini-3-flash-preview
  if (process.env.MODEL) return process.env.MODEL;
  const provider = process.env.MODEL_PROVIDER ?? "google";
  const modelId = process.env.MODEL_ID ?? "gemini-3-flash-preview";
  return `${provider}:${modelId}`;
}

// Silence favicon requests — browsers hit /favicon.ico on every visit
app.get("/favicon.ico", (_req, res) => res.sendStatus(204));

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    model: defaultModel(),
    keys: configuredKeys(),
    routes: {
      "GET /v1/skills": "List available skills",
      "GET /v1/workers/progress": "Live progress of parallel workers",
      "POST /v1/plan": "Preview the agent's execution plan",
      "POST /v1/run": "Run the agent (set stream=true for SSE)",
    },
  });
});

app.get("/v1/skills", async (_req, res) => {
  const skills = await discoverSkills();
  res.json(
    skills.map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category ?? "Other",
      resources: s.resources,
    })),
  );
});

app.get("/v1/workers/progress", (_req, res) => {
  const progress: Record<string, unknown> = {};
  for (const [id, wp] of workerProgress.entries()) {
    progress[id] = wp;
  }
  res.json(progress);
});

app.post("/v1/plan", async (req, res) => {
  const { prompt, model } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const modelConfig = parseModel(model);
    const agent = await createAgentFromEnv(modelConfig ? { model: modelConfig } : undefined);
    const plan = await agent.plan(prompt);
    res.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
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

// JSON 404 handler — Express's default returns HTML, which breaks
// JSON clients that try to res.json() the body.
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// JSON error handler — converts body-parser errors and unhandled
// exceptions into clean JSON. Express's default leaks stack traces
// as HTML which is bad DX for API clients and a mild info leak.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : String(err);
  // body-parser errors carry a `status` field with the right HTTP code
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode
    ?? 500;
  res.status(status).json({ error: message });
});

function startupWarnings(): void {
  if (!process.env.FIRECRAWL_API_KEY) {
    console.warn("  ⚠  FIRECRAWL_API_KEY is not set — requests will fail.\n");
    return;
  }
  const providerKeyEnv: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    gateway: "AI_GATEWAY_API_KEY",
    "custom-openai": "CUSTOM_OPENAI_API_KEY",
  };
  const provider = defaultModel().split(":")[0];
  const required = providerKeyEnv[provider];
  if (required && !process.env[required]) {
    console.warn(`  ⚠  ${required} is not set (required for provider "${provider}"). Run \`npm run doctor\` for details.\n`);
  }
}

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`\n  firecrawl-agent  http://localhost:${port}  ${defaultModel()}  keys: ${configuredKeys().join(", ")}\n`);
  startupWarnings();
});

// Graceful shutdown — stop accepting new requests, let in-flight ones finish.
// Required for clean deploys on Docker, k8s, Railway, Fly, etc.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`\n  ${sig} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
