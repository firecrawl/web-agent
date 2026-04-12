/**
 * 2. Structured output — ask for JSON, parse the result.
 *
 *   npx tsx --env-file=.env examples/2-structured-output.ts
 */
import { createFirecrawlAgent } from "../src";

const agent = await createFirecrawlAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: "anthropic:claude-sonnet-4-6",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: `Get Vercel's pricing tiers. Return JSON matching:
{ "tiers": [{ "name": string, "price": string, "features": string[] }] }
Call formatOutput with format "json" when done.`,
    },
  ],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content, null, 2));
