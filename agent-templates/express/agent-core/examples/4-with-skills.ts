/**
 * 4. Skills — SKILL.md files in src/skills/definitions/ auto-load.
 *    Point `skills: ["/path"]` at your own dir to add more.
 *
 *   npx tsx --env-file=.env examples/4-with-skills.ts
 */
import { createFirecrawlAgent } from "../src";

const agent = await createFirecrawlAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: "anthropic:claude-sonnet-4-6",
  // DEFAULT_SKILLS_DIR is included automatically; pass more here:
  // skills: ["/absolute/path/to/your/skills/"],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Find the P/E ratio, current stock price, and latest news headline for AAPL.",
    },
  ],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content));
