import { generateText } from "ai";
import { createDeepAgent, type DeepAgent, type SubAgent } from "deepagents";
import { tool as lcTool } from "langchain";
import { initChatModel } from "langchain/chat_models/universal";
import { resolveModel } from "./resolve-model";
import { discoverSkills, getDefaultSkillsDir } from "./skills/discovery";
import { buildFirecrawlToolkit } from "./toolkit";
import { formatOutput, bashExec, createExportSkillTool, initBashWithFiles } from "./tools";
import { workerProgress } from "./worker";
import type {
  CreateAgentOptions,
  ExportedSkill,
  ModelConfig,
  Toolkit,
  RunParams,
  RunResult,
  AgentEvent,
  StepDetail,
} from "./types";

// --- AI SDK tool → LangChain tool shim ---
// `tool({...})` from "ai" is an identity helper at runtime. Extract the three
// fields Deep Agents needs and wrap with langchain's `tool()`.
//
// This wrapper also **gates `formatOutput`**: it reads a per-run `runState`
// object off `config.configurable` (injected from the request handler) and
// refuses to run formatOutput until at least one data-collection tool has
// returned non-empty output. Prompts tell the model this too, but that's
// advice — this is enforcement. Stops the "formatOutput called prematurely
// with stub data" failure mode at the source.
const DATA_TOOLS = new Set([
  "scrape", "scrapeBash", "search", "interact",
  "extract", "crawl", "map", "batchScrape",
]);

function resultHasData(result: unknown): boolean {
  if (result == null) return false;
  if (typeof result === "string") return result.trim().length > 0;
  if (typeof result === "object") {
    const o = result as Record<string, unknown>;
    // Explicit error envelope → not data
    if (typeof o.error === "string" && o.error) return false;
    // Search/scrape-style shapes — consider data present if any of these
    // resolve to non-empty.
    const candidates = [
      o.markdown, o.content, o.html, o.stdout, o.text, o.data,
      o.web, o.news, o.images, o.results, o.pages, o.links,
      o.json, o.extract, o.preview,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return true;
      if (Array.isArray(c) && c.length > 0) return true;
      if (c && typeof c === "object" && Object.keys(c as object).length > 0) return true;
    }
    // Fallback: any non-metadata key means something came back
    const META = new Set(["creditsUsed", "status", "statusCode", "scrapeId", "cacheState", "cachedAt", "proxyUsed", "url"]);
    return Object.keys(o).some((k) => !META.has(k));
  }
  return true;
}

function aiToolToLc(name: string, t: any) {
  return lcTool(
    async (input: unknown, config?: { configurable?: { runState?: { dataCollected?: boolean } } }) => {
      const runState = config?.configurable?.runState;

      if (name === "formatOutput" && runState && !runState.dataCollected) {
        return JSON.stringify({
          error:
            "No data collected yet. You must call a data-gathering tool " +
            "(search, scrape, scrapeBash, interact, extract, map, or crawl) " +
            "and receive a non-empty result before calling formatOutput. " +
            "Gather the data first, then call formatOutput with the results.",
        });
      }

      const result = await t.execute!(input as never);

      if (runState && DATA_TOOLS.has(name) && resultHasData(result)) {
        runState.dataCollected = true;
      }

      return typeof result === "string" ? result : JSON.stringify(result);
    },
    { name, description: t.description ?? "", schema: t.inputSchema as never },
  );
}

function aiToolkitToLc(tools: Record<string, any>) {
  return Object.entries(tools).map(([n, t]) => aiToolToLc(n, t));
}

// --- Model resolver: ModelConfig → LangChain chat model for Deep Agents ---
// Uses langchain's universal `initChatModel` factory, so every provider works
// without a per-provider switch case.
async function resolveLcModel(config: ModelConfig, apiKeys?: Record<string, string>) {
  const keyFor = config.apiKey ?? apiKeys?.[config.provider];
  const modelName = `${config.provider}:${config.model}`;
  const opts: Record<string, unknown> = {};
  if (keyFor) opts.apiKey = keyFor;
  if (config.baseURL) opts.configuration = { baseURL: config.baseURL };
  return initChatModel(modelName, opts);
}

export class FirecrawlAgent {
  constructor(private options: CreateAgentOptions) {}

  private sumWorkerUsage() {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const w of workerProgress.values()) {
      inputTokens += w.inputTokens ?? 0;
      outputTokens += w.outputTokens ?? 0;
    }
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  async run(params: RunParams): Promise<RunResult> {
    if (!params.prompt?.trim()) {
      throw new Error("prompt is required and must be a non-empty string");
    }
    workerProgress.clear();
    const startTime = Date.now();
    const agent = await this.buildAgent(params);
    const allMsgs: any[] = [];
    const result = await agent.invoke({
      messages: [{ role: "user", content: this.buildPrompt(params) }],
    });
    for (const m of result.messages ?? []) allMsgs.push(m);

    const steps = this.mapSteps(allMsgs);
    const extracted = this.extractFormattedOutput(steps, params.format);
    const workerUsage = this.sumWorkerUsage();
    const modelUsage = this.sumModelUsage(allMsgs);

    const runResult: RunResult = {
      text: extracted?.content ?? this.finalText(allMsgs),
      data: extracted?.content,
      format: extracted?.format ?? params.format,
      steps,
      usage: {
        inputTokens: modelUsage.inputTokens + workerUsage.inputTokens,
        outputTokens: modelUsage.outputTokens + workerUsage.outputTokens,
        totalTokens: modelUsage.totalTokens + workerUsage.totalTokens,
      },
      durationMs: Date.now() - startTime,
    };

    if (params.onStep) {
      for (const step of steps) {
        if (step.text) params.onStep({ type: "text", text: step.text });
        for (const tc of step.toolCalls) {
          params.onStep({ type: "tool-call", toolName: tc.name, input: tc.input });
        }
      }
    }

    const exported = this.extractExportedSkill(steps);
    if (exported) runResult.exportedSkill = exported;

    return runResult;
  }

  async *stream(params: RunParams): AsyncGenerator<AgentEvent> {
    if (!params.prompt?.trim()) {
      throw new Error("prompt is required and must be a non-empty string");
    }
    workerProgress.clear();
    const agent = await this.buildAgent(params);
    const allMsgs: any[] = [];

    try {
      for await (const [mode, chunk] of await agent.stream(
        { messages: [{ role: "user", content: this.buildPrompt(params) }] },
        { streamMode: ["messages", "updates"] },
      )) {
        if (mode === "messages") {
          const [msg] = chunk as unknown as [any, unknown];
          if (msg?.text) yield { type: "text", content: msg.text };
          for (const tc of msg?.tool_calls ?? []) {
            yield { type: "tool-call", toolName: tc.name, input: tc.args };
          }
        } else if (mode === "updates") {
          const update = chunk as Record<string, any>;
          for (const node of Object.values(update)) {
            for (const m of (node as any)?.messages ?? []) {
              allMsgs.push(m);
              const t = m?.type ?? m?._getType?.();
              if (t === "tool" || t === "ToolMessage") {
                yield { type: "tool-result", toolName: m.name, output: m.content };
              }
            }
          }
        }
      }
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
      return;
    }

    const steps = this.mapSteps(allMsgs);
    const extracted = this.extractFormattedOutput(steps, params.format);
    const workerUsage = this.sumWorkerUsage();
    const modelUsage = this.sumModelUsage(allMsgs);

    yield {
      type: "done",
      text: extracted?.content ?? this.finalText(allMsgs),
      steps,
      usage: {
        inputTokens: modelUsage.inputTokens + workerUsage.inputTokens,
        outputTokens: modelUsage.outputTokens + workerUsage.outputTokens,
        totalTokens: modelUsage.totalTokens + workerUsage.totalTokens,
      },
    };
  }

  toResponse(params: RunParams): Response {
    const encoder = new TextEncoder();
    const self = this;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of self.stream(params)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  async sse(
    params: RunParams,
    res: { setHeader(k: string, v: string): void; write(c: string): void; end(): void },
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    try {
      for await (const event of this.stream(params)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`);
    } finally {
      res.end();
    }
  }

  async plan(prompt: string): Promise<string> {
    const model = await resolveModel(this.options.model, this.options.apiKeys);
    const skills = await discoverSkills(this.options.skillsDir);
    const skillList = skills.length
      ? `\nAvailable skills: ${skills.map((s) => `${s.name} (${s.description.slice(0, 60)})`).join(", ")}`
      : "";

    const { text } = await generateText({
      model,
      system: `You are a planning agent for a web research tool powered by Firecrawl. Given a user's request, produce a clear, numbered execution plan.

Available tools:
- search: Web search to discover relevant pages
- scrape: Extract content from a URL (supports query parameter for targeted extraction)
- interact: Click buttons, fill forms, handle JavaScript-heavy pages
- bashExec: Process data with jq, awk, sed, grep, sort, etc.
- formatOutput: Export results as JSON or text
- Sub-agents / spawnAgents: optional; use only when many independent targets or a specialist sub-agent clearly fits${skillList}

For each step, specify:
1. What tool to use
2. What input/URL/query
3. What data you expect to get
4. How it feeds into the next step

Be specific about URLs, search queries, and extraction targets. Keep it concise -- one line per step.
End with the expected final output format and structure.
Do not use emojis.`,
      prompt: `Create an execution plan for this request:\n\n${prompt}`,
      maxOutputTokens: 1024,
    });

    return text;
  }

  async createRawAgent(params: RunParams): Promise<DeepAgent> {
    return this.buildAgent(params);
  }

  // --- Private helpers ---

  private _toolkit: Toolkit | null = null;

  private getToolkit(): Toolkit {
    if (this._toolkit) return this._toolkit;
    this._toolkit =
      this.options.toolkit ??
      buildFirecrawlToolkit(this.options.firecrawlApiKey, this.options.firecrawlOptions);
    return this._toolkit;
  }

  private async buildAgent(params: RunParams): Promise<DeepAgent> {
    const model = await resolveLcModel(this.options.model, this.options.apiKeys);
    const subAgentModel = this.options.subAgentModel
      ? await resolveLcModel(this.options.subAgentModel, this.options.apiKeys)
      : model;
    const toolkit = this.getToolkit();
    const skillsDir = this.options.skillsDir ?? getDefaultSkillsDir();

    const uploadedFiles: Record<string, string> = {};
    if (params.uploads?.length) {
      for (const upload of params.uploads) {
        const isText =
          upload.type.startsWith("text/") ||
          /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(upload.name);
        const safe = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        uploadedFiles[isText ? `/data/${safe}` : `/data/${safe}.b64`] = upload.content;
      }
    }
    if (Object.keys(uploadedFiles).length > 0) await initBashWithFiles(uploadedFiles);

    const exportSkillTool = createExportSkillTool(skillsDir);

    // Tools the sub-agents get: data-gathering only. `formatOutput` and
    // `exportSkill` are ORCHESTRATOR-ONLY — a sub-agent calling formatOutput
    // would open the artifact panel mid-run with partial data. `bashExec`
    // stays available because sub-agents may need to reshape data.
    const subAgentTools = [
      ...aiToolkitToLc(toolkit.tools as Record<string, any>),
      aiToolToLc("bashExec", bashExec),
    ];

    // Orchestrator tool set includes the terminal formatOutput + exportSkill.
    const tools = [
      ...subAgentTools,
      aiToolToLc("formatOutput", formatOutput),
      aiToolToLc("exportSkill", exportSkillTool),
    ];

    // Override Deep Agents' default "general-purpose" sub-agent so it inherits
    // the RESTRICTED tool set. Otherwise it clones the parent's tools and can
    // fire formatOutput prematurely from inside a task run.
    const generalPurposeSubAgent: SubAgent = {
      name: "general-purpose",
      description: "General-purpose data-gathering sub-agent. Use for multi-step research requiring search/scrape/scrapeBash. Returns raw findings; DOES NOT format final output — that's the orchestrator's job.",
      systemPrompt: "You are a data-gathering sub-agent. Use search/scrape/scrapeBash/interact/extract/map/crawl to collect what was requested. Return ONLY a terse JSON-shaped block of raw facts (fields, URLs, numbers). No prose. No 'summary'. No narration. No markdown headings or bullet commentary. No reflection on what you did. Just the data. Example good output: `{ \"ticker\": \"NVDA\", \"price\": 142.15, \"pe_ratio\": 68.3, \"sources\": [\"https://…\"] }`. The orchestrator will aggregate your raw data with others and produce the final artifact — you don't need to summarize, explain, or format.",
      model: subAgentModel,
      tools: subAgentTools,
      skills: [skillsDir],
    };

    const userSubagents: SubAgent[] = await Promise.all(
      (params.subAgents ?? []).map(async (cfg) => {
        const filtered = toolkit.createFiltered ? toolkit.createFiltered(cfg.tools) : toolkit.tools;
        return {
          name: cfg.name,
          description: cfg.description,
          systemPrompt: cfg.instructions ?? `You are ${cfg.name}.`,
          model: cfg.model ? await resolveLcModel(cfg.model, this.options.apiKeys) : subAgentModel,
          tools: aiToolkitToLc(filtered as Record<string, any>),
          skills: cfg.skills ?? [],
        };
      }),
    );

    const subagents: SubAgent[] = [generalPurposeSubAgent, ...userSubagents];

    const appSystemPrompt = (this.options.appSections ?? []).join("\n\n");
    const systemPrompt = [toolkit.systemPrompt, appSystemPrompt].filter(Boolean).join("\n\n");

    const skills = [skillsDir, ...(params.skills ?? [])];

    // NB: Deep Agents already includes SummarizationMiddleware in its default
    // stack — passing another instance throws "Middleware ... defined multiple
    // times". We trust the default thresholds for now; if history bloat recurs,
    // we'll need to override via a custom graph or monkey-patch the default.
    return createDeepAgent({
      model: model as any,
      tools,
      subagents,
      skills,
      systemPrompt: systemPrompt || undefined,
    });
  }

  private buildPrompt(params: RunParams): string {
    const parts = [params.prompt];
    if (params.urls?.length) parts.push(`\n\nStart with these URLs: ${params.urls.join(", ")}`);
    if (params.schema) {
      parts.push(
        `\n\nReturn data matching this schema exactly:\n\`\`\`json\n${JSON.stringify(params.schema, null, 2)}\n\`\`\`\nCall formatOutput with format "json" and the collected data when done.`,
      );
    }
    if (params.columns?.length) {
      parts.push(
        `\n\nRequired columns: ${params.columns.join(", ")}\nCall formatOutput with format "json" and include data with these columns: ${JSON.stringify(params.columns)} when done.`,
      );
    }
    if (params.format === "markdown" && !params.schema && !params.columns) {
      parts.push(`\n\nCall formatOutput with format "text" and the markdown content when done.`);
    }
    return parts.join("");
  }

  private mapSteps(messages: any[]): StepDetail[] {
    const steps: StepDetail[] = [];
    let current: StepDetail = { text: "", toolCalls: [], toolResults: [] };
    for (const msg of messages) {
      const t = msg?.type ?? msg?._getType?.();
      if (t === "ai" || t === "AIMessage" || t === "AIMessageChunk") {
        if (current.text || current.toolCalls.length || current.toolResults.length) {
          steps.push(current);
          current = { text: "", toolCalls: [], toolResults: [] };
        }
        if (msg.content) current.text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        for (const tc of msg.tool_calls ?? []) {
          current.toolCalls.push({ name: tc.name, input: tc.args });
        }
      } else if (t === "tool" || t === "ToolMessage") {
        const output = this.tryParse(msg.content);
        current.toolResults.push({ name: msg.name, output });
      }
    }
    if (current.text || current.toolCalls.length || current.toolResults.length) {
      steps.push(current);
    }
    return steps;
  }

  private finalText(messages: any[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const t = m?.type ?? m?._getType?.();
      if ((t === "ai" || t === "AIMessage" || t === "AIMessageChunk") && m.content) {
        return typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      }
    }
    return "";
  }

  private sumModelUsage(messages: any[]) {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const m of messages) {
      const u = m?.usage_metadata ?? m?.response_metadata?.usage;
      if (u) {
        inputTokens += u.input_tokens ?? u.promptTokens ?? 0;
        outputTokens += u.output_tokens ?? u.completionTokens ?? 0;
      }
    }
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  private extractFormattedOutput(
    steps: StepDetail[],
    format?: string,
  ): { format: string; content: string } | null {
    if (!format) return null;
    for (const step of [...steps].reverse()) {
      for (const tr of step.toolResults) {
        if (tr.name === "formatOutput") {
          const parsed = (tr.output ?? {}) as { format?: string; content?: string };
          if (parsed.content) return { format: parsed.format ?? format, content: parsed.content };
        }
      }
    }
    return null;
  }

  private extractExportedSkill(steps: StepDetail[]): ExportedSkill | null {
    for (const step of [...steps].reverse()) {
      for (const tr of step.toolResults) {
        if (tr.name === "exportSkill") {
          const parsed = (tr.output ?? {}) as { name?: string; skillMd?: string };
          if (parsed.skillMd) {
            return {
              name: parsed.name ?? "exported-skill",
              skillMd: parsed.skillMd,
              workflow: "",
              schema: "",
            };
          }
        }
      }
    }
    return null;
  }

  private tryParse(x: unknown): unknown {
    if (typeof x !== "string") return x;
    try {
      return JSON.parse(x);
    } catch {
      return x;
    }
  }
}

export function createAgent(options: CreateAgentOptions): FirecrawlAgent {
  return new FirecrawlAgent(options);
}

export function createAgentFromEnv(overrides?: Partial<CreateAgentOptions>): FirecrawlAgent {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const apiKeys: Record<string, string> = {};
  const envMap: Record<string, string> = {
    ANTHROPIC_API_KEY: "anthropic",
    OPENAI_API_KEY: "openai",
    GOOGLE_GENERATIVE_AI_API_KEY: "google",
    AI_GATEWAY_API_KEY: "gateway",
    CUSTOM_OPENAI_API_KEY: "custom-openai",
  };
  for (const [env, id] of Object.entries(envMap)) {
    if (process.env[env]) apiKeys[id] = process.env[env]!;
  }
  if (process.env.CUSTOM_OPENAI_BASE_URL) {
    apiKeys["custom-openai:baseURL"] = process.env.CUSTOM_OPENAI_BASE_URL;
  }

  const provider = (overrides?.model?.provider ?? process.env.MODEL_PROVIDER ?? "google") as ModelConfig["provider"];

  // Early check: warn if the selected provider has no API key configured
  const providerKeyMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_GENERATIVE_AI_API_KEY",
    gateway: "AI_GATEWAY_API_KEY",
    "custom-openai": "CUSTOM_OPENAI_API_KEY",
  };
  const requiredEnv = providerKeyMap[provider];
  if (requiredEnv && !apiKeys[provider]) {
    throw new Error(
      `${requiredEnv} not set (required for provider "${provider}"). ` +
      `Set it in your .env file or switch providers via MODEL_PROVIDER.`,
    );
  }

  return new FirecrawlAgent({
    firecrawlApiKey,
    model: {
      provider,
      model: overrides?.model?.model ?? process.env.MODEL_ID ?? "gemini-3-flash-preview",
    },
    apiKeys,
    ...overrides,
  });
}
