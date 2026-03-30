import { ToolLoopAgent, tool, stepCountIs, type LanguageModel } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import { z } from "zod";
import { bashExec } from "./bash-tool";
import { formatOutput } from "./tools";
import type { SkillMetadata } from "../types";
import { createSkillTools } from "../skills/tools";

export function createWorkerTool(
  model: LanguageModel,
  firecrawlApiKey: string,
  skills: SkillMetadata[],
) {
  const { systemPrompt: _, ...fcTools } = FirecrawlTools({ apiKey: firecrawlApiKey });
  const skillTools = createSkillTools(skills);
  const workerTools = { ...fcTools, ...skillTools, formatOutput, bashExec };

  return tool({
    description: `Spawn parallel worker agents to handle independent tasks concurrently. Each worker gets its own isolated context and full toolkit (search, scrape, interact, bash). Workers return only a concise summary — the orchestrator context stays clean. Use this when you have 2+ independent data collection tasks (e.g., scraping multiple sites, researching multiple companies).`,
    inputSchema: z.object({
      tasks: z.array(z.object({
        id: z.string().describe("Short identifier for this task (e.g. 'vercel', 'nvidia')"),
        prompt: z.string().describe("The task for the worker to complete. Be specific about what to find and how to format the result."),
      })).describe("Array of independent tasks to run in parallel"),
    }),
    execute: async ({ tasks }, { abortSignal }) => {
      const results = await Promise.all(
        tasks.map(async (task) => {
          try {
            const worker = new ToolLoopAgent({
              model,
              instructions: `You are a focused worker agent. Complete the task and return a clean, concise result.
- Use search, scrape, and interact as needed.
- Return ONLY the findings — no narration, no "here's what I found", just the data.
- For tabular data, use a markdown table.
- For structured data, use JSON.
- Keep your response under 500 words.
- Save any large datasets to /data/${task.id}.json using bashExec.`,
              tools: workerTools,
              stopWhen: stepCountIs(10),
            });

            const result = await worker.generate({
              prompt: task.prompt,
              abortSignal,
            });

            return {
              id: task.id,
              status: "done" as const,
              result: result.text,
              steps: result.steps.length,
            };
          } catch (err) {
            return {
              id: task.id,
              status: "error" as const,
              result: err instanceof Error ? err.message : "Unknown error",
              steps: 0,
            };
          }
        }),
      );

      return {
        completed: results.filter((r) => r.status === "done").length,
        failed: results.filter((r) => r.status === "error").length,
        total: results.length,
        results,
      };
    },
  });
}
