import { generateText } from "ai";
import fs from "fs/promises";
import path from "path";
import { getTaskModel } from "@/config";
import { resolveModel } from "@agent-core";
import { getProviderKey } from "@/lib/config/keys";

const SKILLS_DIR = path.join(process.cwd(), "agent-core", "src", "skills", "definitions");

function getApiKeys() {
  const keys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) keys[p] = k;
  }
  return keys;
}

export async function POST(req: Request) {

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
    const model = await resolveModel(getTaskModel("skillGeneration"), getApiKeys());

    const { text: skillContent } = await generateText({
      model,
      system: `You generate SKILL.md files that capture procedural web knowledge -- the HOW of accomplishing a task on the web. Skills are agent-agnostic and tool-agnostic. They describe the process, not the implementation.

Given a session transcript, distill what was LEARNED about how to accomplish this type of task on the web. Focus on:
- What pages/sites to visit and why
- What data lives where and how it's structured
- What interactions are needed (clicking tabs, expanding sections, pagination)
- What patterns work and what doesn't
- How to verify the data is correct
- How to handle edge cases

Produce a SKILL.md with this format:

---
name: skill-name
description: One-line description of what this skill teaches
---

# Skill Title

## What This Skill Teaches
One paragraph explaining the procedural knowledge captured here.

## Where to Find the Data
- Which sites/pages contain the relevant information
- URL patterns, sitemaps, or search strategies that work
- What sections of a page to focus on

## Step-by-Step Process
1. First step...
2. Second step...
(Imperative mood. Describe the process, not specific tool calls.)

## Data Structure
What fields/data points to extract and how they relate to each other.

## Gotchas & Edge Cases
- Things that look like data but aren't
- Pages that require interaction vs static scraping
- Rate limits, paywalls, or anti-bot measures observed
- Fallback approaches when the primary method fails

## Verification
How to validate that the extracted data is correct and complete.

## Example Tasks
- "example prompt 1"
- "example prompt 2"

Output ONLY the SKILL.md content. No extra commentary.`,
      prompt: `Original task: ${prompt}\n\nSkill name: ${name}\n\nSession transcript:\n${transcript.slice(0, 8000)}`,
      maxOutputTokens: 2000,
    });

    // Save to disk
    const skillDir = path.join(SKILLS_DIR, slug);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf-8");

    return Response.json({
      name: slug,
      path: `agent-core/src/skills/definitions/${slug}/SKILL.md`,
      content: skillContent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Skills generate error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
