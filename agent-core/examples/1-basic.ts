/**
 * 1. Basic usage — one function, one invoke.
 *
 *   npx tsx --env-file=.env examples/1-basic.ts
 */
import { createFirecrawlAgent } from "../src";

if (!process.env.FIRECRAWL_API_KEY) {
  console.error("FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev/app/api-keys");
  process.exit(1);
}

const agent = await createFirecrawlAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  model: "anthropic:claude-sonnet-4-6",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What are the top 3 stories on Hacker News right now?" }],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content));
