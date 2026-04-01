import { ToolLoopAgent, tool, stepCountIs, type LanguageModel } from "ai";
import { FirecrawlTools } from "firecrawl-aisdk";
import { z } from "zod";
import { bashExec, formatOutput } from "../tools";
import type { SkillMetadata } from "../types";
import { createSkillTools } from "../skills/tools";
import { loadWorkerPrompt } from "./loader";

// --- Progress tracking (persists across HMR) ---

export interface WorkerProgress {
  id: string;
  status: "running" | "done" | "error";
  steps: number;
  currentTool?: string;
  currentInput?: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  stepLog: { tool: string; detail: string; input: Record<string, unknown> }[];
}

const g = globalThis as unknown as {
  __workerProgress?: Map<string, WorkerProgress>;
};
if (!g.__workerProgress) g.__workerProgress = new Map();
export const workerProgress = g.__workerProgress;

export interface WorkerStepDetail {
  toolCalls: { name: string; input: string }[];
  text: string;
}

export interface WorkerResult {
  id: string;
  status: "done" | "error";
  result: string;
  steps: number;
  tokens: number;
  stepDetails: WorkerStepDetail[];
}

// --- Worker tool ---

export interface WorkerToolOptions {
  maxWorkers?: number;
  workerMaxSteps?: number;
}

export function createWorkerTool(
  model: LanguageModel,
  firecrawlApiKey: string,
  skills: SkillMetadata[],
  options: WorkerToolOptions = {},
) {
  const { maxWorkers = 6, workerMaxSteps = 10 } = options;

  const { systemPrompt: _, ...fcTools } = FirecrawlTools({
    apiKey: firecrawlApiKey,
  });
  const skillTools = createSkillTools(skills);
  const workerTools = { ...fcTools, ...skillTools, formatOutput, bashExec };

  return tool({
    description: `Spawn parallel worker agents to handle independent tasks concurrently. Each worker gets its own isolated context and full toolkit (search, scrape, interact, bash). Workers return only a concise summary — the orchestrator context stays clean. Use this when you have 2+ independent data collection tasks.`,
    inputSchema: z.object({
      tasks: z
        .array(
          z.object({
            id: z.string().describe("Short identifier (e.g. 'vercel', 'nvidia')"),
            prompt: z.string().describe("The task to complete. Be specific."),
          }),
        )
        .describe("Array of independent tasks to run in parallel"),
    }),
    execute: async ({ tasks }, { abortSignal }) => {
      const limited = tasks.slice(0, maxWorkers);

      for (const task of limited) {
        workerProgress.set(task.id, {
          id: task.id,
          status: "running",
          steps: 0,
          tokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          stepLog: [],
        });
      }

      const results: WorkerResult[] = await Promise.all(
        limited.map(async (task) => {
          try {
            const workerInstructions = await loadWorkerPrompt({
              TASK_ID: task.id,
            });
            const worker = new ToolLoopAgent({
              model,
              instructions: workerInstructions,
              tools: workerTools,
              stopWhen: stepCountIs(workerMaxSteps),
            });

            const result = await worker.generate({
              prompt: task.prompt,
              abortSignal,
              onStepFinish: ({ toolCalls, usage }) => {
                const prev = workerProgress.get(task.id);
                const prevLog = prev?.stepLog ?? [];

                const newSteps = (toolCalls ?? []).map((call) => {
                  const c = (call ?? {}) as Record<string, unknown>;
                  const args = (c.args ?? c.input ?? {}) as Record<string, unknown>;
                  const name = (c.toolName as string) ?? "thinking";
                  let detail = "";
                  if (name === "search") detail = `Searched: "${args.query ?? ""}"`;
                  else if (name === "scrape") detail = `${args.url ?? ""}`;
                  else if (name === "interact") detail = `${args.url ?? ""}`;
                  else if (name === "bashExec" || name === "bash_exec")
                    detail = String(args.command ?? "").slice(0, 80);
                  else if (name === "load_skill")
                    detail = String(args.name ?? args.skill ?? "");
                  else detail = JSON.stringify(args).slice(0, 80);
                  return { tool: name, detail, input: args };
                });
                if (newSteps.length === 0)
                  newSteps.push({ tool: "thinking", detail: "", input: {} });

                const lastTool = toolCalls?.[toolCalls.length - 1];
                const toolName = lastTool?.toolName ?? "thinking";
                const tc = lastTool as Record<string, unknown> | undefined;
                const toolInput = tc?.args
                  ? JSON.stringify(tc.args).slice(0, 80)
                  : "";
                workerProgress.set(task.id, {
                  id: task.id,
                  status: "running",
                  steps: (prev?.steps ?? 0) + 1,
                  currentTool: toolName,
                  currentInput: toolInput || undefined,
                  tokens: (prev?.tokens ?? 0) + (usage?.totalTokens ?? 0),
                  inputTokens:
                    (prev?.inputTokens ?? 0) + (usage?.inputTokens ?? 0),
                  outputTokens:
                    (prev?.outputTokens ?? 0) + (usage?.outputTokens ?? 0),
                  stepLog: [...prevLog, ...newSteps],
                });
              },
            });

            const tokens = workerProgress.get(task.id)?.tokens ?? 0;
            const donePrev = workerProgress.get(task.id);
            workerProgress.set(task.id, {
              id: task.id,
              status: "done",
              steps: result.steps.length,
              tokens,
              inputTokens: donePrev?.inputTokens ?? 0,
              outputTokens: donePrev?.outputTokens ?? 0,
              stepLog: donePrev?.stepLog ?? [],
            });

            return {
              id: task.id,
              status: "done" as const,
              result: result.text,
              steps: result.steps.length,
              tokens,
              stepDetails: result.steps.map((s) => ({
                toolCalls: s.toolCalls.map((tc) => {
                  const c = tc as Record<string, unknown>;
                  return {
                    name: tc?.toolName ?? "unknown",
                    input: JSON.stringify(c?.args ?? c?.input ?? {}).slice(0, 100),
                  };
                }),
                text: s.text?.slice(0, 200) ?? "",
              })),
            };
          } catch (err) {
            workerProgress.set(task.id, {
              id: task.id,
              status: "error",
              steps: 0,
              tokens: 0,
              inputTokens: 0,
              outputTokens: 0,
              stepLog: [],
            });
            return {
              id: task.id,
              status: "error" as const,
              result: err instanceof Error ? err.message : "Unknown error",
              steps: 0,
              tokens: 0,
              stepDetails: [],
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
