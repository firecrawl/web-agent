import { streamText } from "ai";
import fs from "fs/promises";
import path from "path";
import { getTaskModel, getExperimentalFeatures } from "@agent/_config";
import { resolveModel, getDefaultSkillsDir } from "@/agent-core";
import { getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";

export async function POST(req: Request) {
  if (!getExperimentalFeatures().generateSkillMd) {
    return Response.json({ error: "SKILL.md generation is disabled in app/(agent)/_config.ts" }, { status: 404 });
  }

  let body: { name: string; messages: unknown[]; prompt: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, messages, prompt } = body;

  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return Response.json({ error: "Invalid skill name" }, { status: 400 });
  }

  const transcript = (messages as { role?: string; text?: string; toolName?: string; input?: unknown; output?: unknown }[])
    .map((m) => {
      if (m.role === "user" && m.text) return `USER: ${m.text}`;
      if (m.role === "assistant" && m.text) return `AGENT: ${m.text}`;
      if (m.toolName) {
        const inputStr = m.input ? JSON.stringify(m.input).slice(0, 300) : "";
        const outputStr = m.output ? JSON.stringify(m.output).slice(0, 300) : "";
        return `TOOL [${m.toolName}]: input=${inputStr} output=${outputStr}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  try {
    const model = await resolveModel(hydrateModelConfig(getTaskModel("skillGeneration")), getProviderApiKeys());

    const result = streamText({
      model,
      system: `You generate a single SKILL.md file that captures the ENTIRE procedure as ONE unified skill — a reusable playbook an agent can follow to repeat the task end-to-end.

CRITICAL RULES:
1. **ONE skill, entire procedure.** Combine ALL steps from the session into a single skill. Do NOT split into sub-skills or multiple procedures. The skill must capture the complete workflow from start to finish, including any parallel sub-agent work.
2. **Every skill MUST use Firecrawl tools.** The procedure MUST include Firecrawl tool calls (search, scrape, interact). A skill without Firecrawl tools is useless — the whole point is to capture a web data collection procedure powered by Firecrawl.
3. **Generalize.** If the session scraped "AAPL" from Yahoo Finance, the skill must work for ANY ticker. Use parameters like {TICKER}, {COMPANY}, {URL}. The skill name must be generic (e.g. "yahoo-finance-financials" not "aapl-financials").
4. **Match the actual method.** If the agent used \`scrape\` with a \`query\` parameter, say that. If it used \`interact\` with clicks, say that. NEVER describe a method that wasn't used in the transcript.
5. **Focus on procedure, not data.** The data is fleeting. The method is what matters. Document HOW the agent got the data, not WHAT the data was.
6. **Be proportional.** A 3-step session gets a concise skill. Don't pad with speculation.

Given a session transcript, extract the winning path — what tools were called, with what inputs, in what order.

Produce a SKILL.md:

---
name: generic-skill-name
description: One-line description with {PARAMETERS} for variable parts
---

# Skill Title

## What This Skill Does
One paragraph. Describe the general procedure, not the specific instance.

## Parameters
- {PARAM_NAME}: what to substitute (e.g. {TICKER} = stock ticker symbol)

## Procedure
1. Step with exact tool and method used (e.g. "scrape {URL} with query: 'Extract all pricing tiers...'")
2. Next step...
(Imperative mood. Include actual query strings and URL patterns from the session.)

## Data to Extract
Expected fields and format.

## Gotchas
- What method was used and why (scrape+query vs interact+click)
- Rate limits or access issues observed

## Example Prompts
- "example with specific values filled in"

Output ONLY the SKILL.md content. No extra commentary.`,
      prompt: `Original task: ${prompt}\n\nSkill name: ${name}\n\nSession transcript:\n${transcript.slice(0, 8000)}`,
      maxOutputTokens: 2000,
    });

    const encoder = new TextEncoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            fullContent += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`));
          }

          // Save to disk
          const skillDir = path.join(getDefaultSkillsDir(), slug);
          await fs.mkdir(skillDir, { recursive: true });
          await fs.writeFile(path.join(skillDir, "SKILL.md"), fullContent, "utf-8");

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "done",
            name: slug,
            path: `skills/definitions/${slug}/SKILL.md`,
            content: fullContent,
          })}\n\n`));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "error",
            error: err instanceof Error ? err.message : String(err),
          })}\n\n`));
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Skills generate error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
