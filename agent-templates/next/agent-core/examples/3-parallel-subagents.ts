/**
 * 3. Sub-agents — delegate research tasks. Deep Agents' `task` tool
 *    batches parallel sub-agent calls automatically when the LLM emits
 *    them in one turn.
 *
 *   npx tsx --env-file=.env examples/3-parallel-subagents.ts
 */
import { createFirecrawlAgent } from "../src";

const agent = await createFirecrawlAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: "anthropic:claude-sonnet-4-6",
  subagents: [
    {
      name: "researcher",
      description: "Researches a single company. Returns a concise profile with pricing + latest news.",
      systemPrompt:
        "You are a company researcher. Given a company name, use search + scrape to find pricing and 1-2 recent news items. Return a tight markdown summary.",
    },
  ],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "For each of Vercel, Netlify, and Cloudflare: spawn a researcher sub-agent, then summarize all three together.",
    },
  ],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content));
