/**
 * 4. Skills - load a reusable skill to guide the agent's procedure
 *
 *   npx tsx examples/4-with-skills.ts
 */
import { createAgent } from "../src";

if (!process.env.FIRECRAWL_API_KEY) { console.error("\n  FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev/app/api-keys\n"); process.exit(1); }

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  model: { provider: "anthropic", model: "claude-sonnet-4-6" },
});

const result = await agent.run({
  prompt: "Extract all products from amazon.com/s?k=mechanical+keyboards with prices and ratings",
  format: "json",
  skills: ["e-commerce"],
});

console.log(result.data ?? result.text);
