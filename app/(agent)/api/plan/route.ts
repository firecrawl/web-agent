import { generateText } from "ai";
import type { AgentConfig } from "@agent-core";
import { discoverSkills, resolveModel } from "@agent-core";
import { getTaskModel } from "@agent/_config";
import { getProviderKey } from "@agent/_lib/config/keys";

export const maxDuration = 60;

function getApiKeys() {
  const keys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) keys[p] = k;
  }
  return keys;
}

export async function POST(req: Request) {
  const { prompt, config } = (await req.json()) as {
    prompt: string;
    config: AgentConfig;
  };

  const skills = await discoverSkills();
  const skillList = skills.length
    ? `\nAvailable skills: ${skills.map((s) => `${s.name} (${s.description.slice(0, 60)})`).join(", ")}`
    : "";

  const model = await resolveModel(getTaskModel("plan"), getApiKeys());

  const { text } = await generateText({
    model,
    system: `You are a planning agent for a web research tool powered by Firecrawl. Given a user's request, produce a clear, numbered execution plan.

Available tools:
- search: Web search to discover relevant pages
- scrape: Extract content from a URL (supports query parameter for targeted extraction)
- interact: Click buttons, fill forms, handle JavaScript-heavy pages
- bashExec: Process data with jq, awk, sed, grep, sort, etc.
- formatOutput: Export results as JSON, CSV, markdown
- Sub-agents: Can delegate export formatting to specialized sub-agents${skillList}

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

  return Response.json({ plan: text });
}
