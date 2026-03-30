import { ToolLoopAgent, tool, stepCountIs, type ToolSet } from "ai";
import { z } from "zod";
import { FirecrawlTools } from "firecrawl-aisdk";
import type { SubAgentConfig, SkillMetadata } from "../types";
import { resolveModel } from "../config/resolve-model";
import { createSkillTools } from "../skills/tools";
import { parseSkillBody } from "../skills/parser";
import { formatOutput } from "./tools";
import { bashExec } from "./bash-tool";
import fs from "fs/promises";
import path from "path";

const subagentSchema = z.object({
  task: z.string().describe("The task to delegate"),
});

interface BuiltInSubAgent {
  id: string;
  name: string;
  description: string;
  skill: string;
  maxSteps: number;
}

const BUILTIN_SUBAGENTS: BuiltInSubAgent[] = [
  { id: "create_json", name: "JSON Creator", skill: "export-json", description: "Format collected data as structured JSON and save to /data/", maxSteps: 5 },
  { id: "create_csv", name: "CSV Creator", skill: "export-csv", description: "Format collected data as a CSV table and save to /data/", maxSteps: 5 },
  { id: "create_markdown", name: "Markdown Creator", skill: "export-report", description: "Format collected data as clean markdown and save to /data/", maxSteps: 5 },
];

function makeSubagentTool(
  id: string,
  name: string,
  description: string,
  subAgent: ToolLoopAgent<never, ToolSet, never>,
) {
  return tool({
    description: `Delegate a task to sub-agent "${name}": ${description}`,
    inputSchema: subagentSchema,
    execute: async ({ task }) => {
      const result = await subAgent.generate({ prompt: task });
      const stepDetails = result.steps.map((step) => ({
        text: step.text || "",
        toolCalls: step.toolCalls.map((tc) => {
          const c = tc as Record<string, unknown>;
          return { toolName: tc.toolName, input: c.input ?? c.args ?? {} };
        }),
        toolResults: step.toolResults.map((tr) => {
          const r = tr as Record<string, unknown>;
          return { toolName: tr.toolName, output: r.output ?? r.result ?? {} };
        }),
      }));
      return {
        subAgent: name,
        description,
        task,
        result: result.text,
        steps: result.steps.length,
        stepDetails,
      };
    },
  });
}

function buildSkillCatalog(skills: SkillMetadata[]): string {
  if (!skills.length) return "";
  return `\n\nAvailable skills (use load_skill to activate):\n${skills.map((s) => `- ${s.name}: ${s.description.slice(0, 100)}`).join("\n")}`;
}

async function loadSkillContent(skillName: string, skills: SkillMetadata[]): Promise<string> {
  const skill = skills.find((s) => s.name === skillName);
  if (!skill) return "";
  const content = await fs.readFile(path.join(skill.directory, "SKILL.md"), "utf-8");
  return `\n\n## Skill: ${skill.name}\n${parseSkillBody(content)}`;
}

function buildFullToolset(
  firecrawlApiKey: string,
  skills: SkillMetadata[],
  enabledTools?: ("search" | "scrape" | "interact" | "map")[],
  customInstructions?: Record<string, string>,
): ToolSet {
  const fcToolOptions: Record<string, unknown> = { apiKey: firecrawlApiKey };
  if (enabledTools) {
    if (!enabledTools.includes("search")) fcToolOptions.search = false;
    if (!enabledTools.includes("scrape")) fcToolOptions.scrape = false;
    if (!enabledTools.includes("interact")) fcToolOptions.interact = false;
  }
  const { systemPrompt: _, ...fcTools } = FirecrawlTools(fcToolOptions);
  const skillTools = createSkillTools(skills, customInstructions);
  return { ...fcTools, ...skillTools, formatOutput, bashExec };
}

export async function createSubAgentTools(
  configs: SubAgentConfig[],
  firecrawlApiKey: string,
  skills: SkillMetadata[],
  parentModel?: Awaited<ReturnType<typeof resolveModel>>,
  customInstructions?: Record<string, string>,
): Promise<ToolSet> {
  const subAgentTools: ToolSet = {};
  const skillCatalog = buildSkillCatalog(skills);

  // User-configured sub-agents
  for (const config of configs) {
    const model = await resolveModel(config.model);
    const tools = buildFullToolset(firecrawlApiKey, skills, config.tools, customInstructions);

    let preloadedSkills = "";
    for (const skillName of config.skills) {
      preloadedSkills += await loadSkillContent(skillName, skills);
    }

    const subAgent = new ToolLoopAgent({
      model,
      instructions: `You are a sub-agent named "${config.name}". ${config.description}

You have the full toolkit: search, scrape, interact, bash, formatOutput, and skills.${skillCatalog}

When finished, write a clear summary of what you found.${preloadedSkills}`,
      tools,
      stopWhen: stepCountIs(10),
    });

    subAgentTools[`subagent_${config.id}`] = makeSubagentTool(
      config.id,
      config.name,
      config.description,
      subAgent as unknown as ToolLoopAgent<never, ToolSet, never>,
    );
  }

  // Built-in sub-agents (export formatters, etc.)
  const builtinModel = parentModel ?? await resolveModel({ provider: "anthropic", model: "claude-sonnet-4-5-20250514" });
  const builtinTools = buildFullToolset(firecrawlApiKey, skills, undefined, customInstructions);

  for (const builtin of BUILTIN_SUBAGENTS) {
    const preloadedSkill = await loadSkillContent(builtin.skill, skills);

    const subAgent = new ToolLoopAgent({
      model: builtinModel,
      instructions: `You are a sub-agent: "${builtin.name}". ${builtin.description}.

You have the full toolkit: search, scrape, interact, bash, formatOutput, and skills. Use whatever tools you need to complete the task.${skillCatalog}${preloadedSkill}`,
      tools: builtinTools,
      stopWhen: stepCountIs(builtin.maxSteps),
    });

    subAgentTools[`subagent_${builtin.id}`] = makeSubagentTool(
      builtin.id,
      builtin.name,
      builtin.description,
      subAgent as unknown as ToolLoopAgent<never, ToolSet, never>,
    );
  }

  return subAgentTools;
}
