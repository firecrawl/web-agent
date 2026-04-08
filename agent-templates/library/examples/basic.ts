/**
 * Basic library usage — no server, just import and run.
 *
 *   npx tsx examples/basic.ts
 */
import { createAgent } from "@firecrawl/agent-core";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: "google", model: "gemini-3-flash-preview" },
});

const result = await agent.run({
  prompt: "What are the top 3 stories on Hacker News right now?",
});

console.log(result.text);
