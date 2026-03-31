import { generateText } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import { createOrchestrator, type OrchestratorOptions } from "./orchestrator";
import { resolveModel } from "./resolve-model";
import { discoverSkills } from "./skills/discovery";
import { formatOutput, bashExec } from "./tools";
import { createSkillTools } from "./skills/tools";
import type {
  CreateAgentOptions,
  RunParams,
  RunResult,
  AgentEvent,
  StepDetail,
} from "./types";

export class FirecrawlAgent {
  constructor(private options: CreateAgentOptions) {}

  /**
   * Run the agent to completion. Returns the full result.
   */
  async run(params: RunParams): Promise<RunResult> {
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

    return {
      text: result.text ?? "",
      data: extracted?.content,
      format: extracted?.format ?? params.format,
      steps,
      usage: {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
    };
  }

  /**
   * Stream agent events as an async generator.
   */
  async *stream(params: RunParams): AsyncGenerator<AgentEvent> {
    const orchestrator = await this.buildOrchestrator(params);
    const events: AgentEvent[] = [];

    const result = await orchestrator.generate({
      prompt: params.prompt,
      onStepFinish: ({ text, toolCalls, toolResults, usage }) => {
        if (text) events.push({ type: "text", content: text });
        for (const tc of toolCalls ?? []) {
          if (!tc) continue;
          const c = tc as Record<string, unknown>;
          events.push({
            type: "tool-call",
            toolName: tc.toolName,
            input: c.args ?? c.input,
          });
        }
        for (const tr of toolResults ?? []) {
          if (!tr) continue;
          const r = tr as Record<string, unknown>;
          events.push({
            type: "tool-result",
            toolName: tr.toolName,
            output: r.output ?? r.result,
          });
        }
        if (usage) events.push({ type: "usage", usage });
      },
    });

    // Yield any buffered events
    for (const event of events) {
      yield event;
    }

    const steps = this.mapSteps(result.steps);
    const extracted = this.extractFormattedOutput(result.steps, params.format);

    yield {
      type: "done",
      text: extracted?.content ?? result.text ?? "",
      steps,
      usage: result.usage,
    };
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

  private async buildOrchestrator(params: RunParams) {
    const opts: OrchestratorOptions = {
      config: {
        prompt: params.prompt,
        urls: params.urls,
        schema: params.schema,
        uploads: params.uploads,
        model: this.options.model,
        subAgentModel: this.options.subAgentModel,
        skills: params.skills ?? [],
        skillInstructions: params.skillInstructions,
        subAgents: params.subAgents ?? [],
        maxSteps: params.maxSteps ?? this.options.maxSteps,
      },
      firecrawlApiKey: this.options.firecrawlApiKey,
      apiKeys: this.options.apiKeys,
      skillsDir: this.options.skillsDir,
      maxWorkers: this.options.maxWorkers,
      workerMaxSteps: this.options.workerMaxSteps,
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
    if (format === "json" && schema) {
      return `\n\nReturn the data as JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nCall formatOutput with format "json" when done.`;
    } else if (format === "json") {
      return `\n\nReturn the data as structured JSON. Call formatOutput with format "json" and the data as a well-structured JSON object or array.`;
    } else if (format === "csv" && columns?.length) {
      return `\n\nReturn the data as CSV with columns: ${columns.join(", ")}\nCall formatOutput with format "csv", data as array of objects, columns: ${JSON.stringify(columns)}.`;
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
 *   model: { provider: 'google', model: 'gemini-3-flash-preview' }
 * })
 *
 * const result = await agent.run({ prompt: 'get Vercel pricing' })
 * console.log(result.text)
 * ```
 */
export function createAgent(options: CreateAgentOptions): FirecrawlAgent {
  return new FirecrawlAgent(options);
}
