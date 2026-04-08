import { generateText } from "ai";
import { createOrchestrator, type OrchestratorOptions } from "./orchestrator";
import { resolveModel } from "./resolve-model";
import { discoverSkills } from "./skills/discovery";
import { parseSkillBody } from "./skills/parser";
import { workerProgress } from "./worker";
import { buildFirecrawlToolkit } from "./toolkit";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
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

  /**
   * Run the agent to completion. Returns the full result.
   */
  async run(params: RunParams): Promise<RunResult> {
    workerProgress.clear();
    const orchestrator = await this.buildOrchestrator(params);

    const result = await orchestrator.generate({
      prompt: params.prompt,
      onStepFinish: params.onStep
        ? ({ text, toolCalls, usage }) => {
            if (text) params.onStep!({ type: "text", text });
            for (const tc of toolCalls ?? []) {
              if (!tc) continue;
              const c = tc as Record<string, unknown>;
              params.onStep!({
                type: "tool-call",
                toolName: tc.toolName,
                input: c.args ?? c.input,
              });
            }
            if (usage) params.onStep!({ type: "usage", usage });
          }
        : undefined,
    });

    const steps = this.mapSteps(result.steps);
    const extracted = this.extractFormattedOutput(result.steps, params.format);
    const workerUsage = this.sumWorkerUsage();

    const runResult: RunResult = {
      text: result.text ?? "",
      data: extracted?.content,
      format: extracted?.format ?? params.format,
      steps,
      usage: {
        inputTokens: (result.usage?.inputTokens ?? 0) + workerUsage.inputTokens,
        outputTokens: (result.usage?.outputTokens ?? 0) + workerUsage.outputTokens,
        totalTokens: (result.usage?.totalTokens ?? 0) + workerUsage.totalTokens,
      },
    };

    if (params.exportSkill) {
      runResult.exportedSkill = await this.exportAsSkill(params, steps);
    }

    return runResult;
  }

  /**
   * Stream agent events as an async generator. Events are yielded in real-time
   * as the agent executes — tool calls, results, and text appear as they happen.
   */
  async *stream(params: RunParams): AsyncGenerator<AgentEvent> {
    workerProgress.clear();
    const orchestrator = await this.buildOrchestrator(params);

    // Channel: callback pushes events, generator pulls them
    const queue: AgentEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const push = (event: AgentEvent) => {
      queue.push(event);
      if (resolve) { resolve(); resolve = null; }
    };

    const generatePromise = orchestrator.generate({
      prompt: params.prompt,
      onStepFinish: ({ text, toolCalls, toolResults, usage }) => {
        if (text) push({ type: "text", content: text });
        for (const tc of toolCalls ?? []) {
          if (!tc) continue;
          const c = tc as Record<string, unknown>;
          push({
            type: "tool-call",
            toolName: tc.toolName,
            input: c.args ?? c.input,
          });
        }
        for (const tr of toolResults ?? []) {
          if (!tr) continue;
          const r = tr as Record<string, unknown>;
          push({
            type: "tool-result",
            toolName: tr.toolName,
            output: r.output ?? r.result,
          });
        }
        if (usage) push({ type: "usage", usage });
      },
    }).then((result) => {
      const steps = this.mapSteps(result.steps);
      const extracted = this.extractFormattedOutput(result.steps, params.format);
      const workerUsage = this.sumWorkerUsage();

      push({
        type: "done",
        text: extracted?.content ?? result.text ?? "",
        steps,
        usage: {
          inputTokens: (result.usage?.inputTokens ?? 0) + workerUsage.inputTokens,
          outputTokens: (result.usage?.outputTokens ?? 0) + workerUsage.outputTokens,
          totalTokens: (result.usage?.totalTokens ?? 0) + workerUsage.totalTokens,
        },
      });
      done = true;
      if (resolve) { resolve(); resolve = null; }
    }).catch((err) => {
      push({ type: "error", error: err instanceof Error ? err.message : String(err) });
      done = true;
      if (resolve) { resolve(); resolve = null; }
    });

    // Yield events as they arrive
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (done) break;
      await new Promise<void>((r) => { resolve = r; });
    }

    // Drain any remaining
    while (queue.length > 0) yield queue.shift()!;

    await generatePromise;
  }

  /**
   * Return a Web Response with SSE stream. Works with Next.js, Hono, Bun, etc.
   */
  toResponse(params: RunParams): Response {
    const encoder = new TextEncoder();
    const self = this;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of self.stream(params)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
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

  /**
   * Pipe SSE events directly to an Express/Node response object.
   */
  async sse(
    params: RunParams,
    res: { setHeader(k: string, v: string): void; write(chunk: string): void; end(): void },
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

  /**
   * Generate an execution plan without running the agent.
   */
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
- formatOutput: Export results as JSON, CSV, markdown
- Sub-agents: Can delegate to specialized sub-agents${skillList}

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

  /**
   * Get the raw ToolLoopAgent for AI SDK integration.
   * Use this when you need direct access to the underlying agent.
   */
  async createRawAgent(params: RunParams) {
    return this.buildOrchestrator(params);
  }

  // --- Private helpers ---

  private _toolkit: Toolkit | null = null;

  private getToolkit(): Toolkit {
    if (this._toolkit) return this._toolkit;
    this._toolkit = this.options.toolkit ?? buildFirecrawlToolkit(this.options.firecrawlApiKey, this.options.firecrawlOptions);
    return this._toolkit;
  }

  private async buildOrchestrator(params: RunParams) {
    const opts: OrchestratorOptions = {
      config: {
        prompt: params.prompt,
        urls: params.urls,
        schema: params.schema,
        columns: params.columns,
        uploads: params.uploads,
        model: this.options.model,
        subAgentModel: this.options.subAgentModel,
        skills: params.skills ?? [],
        skillInstructions: params.skillInstructions,
        subAgents: params.subAgents ?? [],
        maxSteps: params.maxSteps ?? this.options.maxSteps,
      },
      toolkit: this.getToolkit(),
      apiKeys: this.options.apiKeys,
      skillsDir: this.options.skillsDir,
      maxWorkers: this.options.maxWorkers,
      workerMaxSteps: this.options.workerMaxSteps,
      appSections: this.options.appSections,
    };

    // Add format-specific instructions to the prompt
    if (params.format) {
      const formatInstructions = this.buildFormatInstructions(params);
      opts.config.prompt = `${params.prompt}${formatInstructions}`;
    }

    return createOrchestrator(opts);
  }

  private buildFormatInstructions(params: RunParams): string {
    const { format, schema, columns } = params;
    // When schema/columns are provided, the research plan in the system prompt
    // already contains the full schema. Keep user-prompt instructions brief.
    if (format === "json" && schema) {
      return `\n\nCollect all data from your research plan, then call formatOutput with format "json".`;
    } else if (format === "json") {
      return `\n\nReturn the data as structured JSON. Call formatOutput with format "json" and the data as a well-structured JSON object or array.`;
    } else if (format === "csv" && columns?.length) {
      return `\n\nCollect all column data from your research plan, then call formatOutput with format "csv" and columns: ${JSON.stringify(columns)}.`;
    } else if (format === "csv") {
      return `\n\nReturn the data as CSV. Call formatOutput with format "csv" and data as array of objects.`;
    } else if (format === "markdown") {
      return `\n\nReturn the data as clean, well-structured markdown. Call formatOutput with format "text" and the markdown content.`;
    }
    return "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSteps(steps: any[]): StepDetail[] {
    return (steps ?? []).map((s) => ({
      text: s.text ?? "",
      toolCalls: (s.toolCalls ?? []).filter(Boolean).map((tc: Record<string, unknown>) => ({
        name: (tc.toolName as string) ?? "",
        input: tc.input ?? tc.args,
      })),
      toolResults: (s.toolResults ?? []).filter(Boolean).map((tr: Record<string, unknown>) => ({
        name: (tr.toolName as string) ?? "",
        output: tr.output ?? tr.result,
      })),
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractFormattedOutput(steps: any[], format?: string): { format: string; content: string } | null {
    if (!format) return null;
    for (const step of [...steps].reverse()) {
      for (const result of step.toolResults ?? []) {
        const r = result as Record<string, unknown>;
        if (r.toolName === "formatOutput") {
          const output = (r.output ?? r.result) as { format?: string; content?: string } | undefined;
          if (output?.content) {
            return { format: output.format ?? format, content: output.content };
          }
        }
      }
    }
    return null;
  }

  /**
   * Post-process a completed run into a reusable skill package.
   * Loads the export-workflow skill instructions and feeds the step history
   * to the model to generate SKILL.md + workflow.mjs + schema.json.
   */
  private async exportAsSkill(
    params: RunParams,
    steps: StepDetail[],
  ): Promise<ExportedSkill> {
    const model = await resolveModel(this.options.model, this.options.apiKeys);

    // Load the export-workflow skill instructions
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const skillPath = path.join(
      this.options.skillsDir ?? path.join(__dirname, "skills", "definitions"),
      "export-workflow",
      "SKILL.md",
    );
    let skillInstructions: string;
    try {
      const raw = await fs.readFile(skillPath, "utf-8");
      skillInstructions = parseSkillBody(raw);
    } catch {
      skillInstructions =
        "Convert the tool call history into a reusable SKILL.md, workflow.mjs, and schema.json.";
    }

    // Serialize the step history for the model
    const stepHistory = steps.map((step, i) => {
      const calls = step.toolCalls.map(
        (tc) => `  ${tc.name}(${JSON.stringify(tc.input)})`,
      );
      const results = step.toolResults.map(
        (tr) =>
          `  ${tr.name} → ${JSON.stringify(tr.output).slice(0, 500)}`,
      );
      return `Step ${i + 1}:\n${calls.join("\n")}\n${results.join("\n")}`;
    });

    const { text } = await generateText({
      model,
      system: `${skillInstructions}

You are post-processing a completed agent run. Generate three files based on the tool call history below.

Return your response as a single JSON object with these keys:
- "name": a slug for the skill (e.g. "vercel-pricing")
- "skillMd": the full SKILL.md content (with frontmatter)
- "workflow": the full workflow.mjs content
- "schema": the full schema.json content

Return ONLY the JSON object, no markdown fences or explanation.`,
      prompt: `Original prompt: ${params.prompt}
${params.urls?.length ? `URLs: ${params.urls.join(", ")}` : ""}
${params.schema ? `Schema: ${JSON.stringify(params.schema)}` : ""}

Tool call history:
${stepHistory.join("\n\n")}`,
      maxOutputTokens: 4096,
    });

    try {
      const parsed = JSON.parse(text);
      return {
        name: parsed.name ?? "exported-skill",
        skillMd: parsed.skillMd ?? "",
        workflow: parsed.workflow ?? "",
        schema: parsed.schema ?? "",
      };
    } catch {
      // If model didn't return valid JSON, return raw text as the skill
      return {
        name: "exported-skill",
        skillMd: text,
        workflow: "",
        schema: "",
      };
    }
  }
}

/**
 * Create a Firecrawl Agent instance.
 *
 * @example
 * ```ts
 * import { createAgent } from '@firecrawl/agent-core'
 *
 * const agent = createAgent({
 *   firecrawlApiKey: 'fc-...',
 *   model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
 * })
 *
 * const result = await agent.run({ prompt: 'get Vercel pricing' })
 * console.log(result.text)
 * ```
 */
export function createAgent(options: CreateAgentOptions): FirecrawlAgent {
  return new FirecrawlAgent(options);
}

/**
 * Create an agent configured entirely from environment variables.
 * Reads FIRECRAWL_API_KEY, MODEL_PROVIDER, MODEL_ID, and all provider keys.
 * Throws if FIRECRAWL_API_KEY is not set.
 */
export function createAgentFromEnv(
  overrides?: Partial<CreateAgentOptions>
): FirecrawlAgent {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const apiKeys: Record<string, string> = {};
  const envMap: Record<string, string> = {
    ANTHROPIC_API_KEY: "anthropic",
    OPENAI_API_KEY: "openai",
    GOOGLE_GENERATIVE_AI_API_KEY: "google",
    AI_GATEWAY_API_KEY: "gateway",
  };
  for (const [env, id] of Object.entries(envMap)) {
    if (process.env[env]) apiKeys[id] = process.env[env]!;
  }

  return new FirecrawlAgent({
    firecrawlApiKey,
    model: {
      provider: (process.env.MODEL_PROVIDER ?? "google") as ModelConfig["provider"],
      model: process.env.MODEL_ID ?? "gemini-3-flash-preview",
    },
    apiKeys,
    ...overrides,
  });
}
