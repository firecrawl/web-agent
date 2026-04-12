/**
 * 3. Parallel sub-agents - multiple companies researched concurrently
 *
 *   npx tsx examples/3-parallel-subagents.ts
 */
import { createAgent } from "../src";

if (!process.env.FIRECRAWL_API_KEY) { console.error("\n  FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev/app/api-keys\n"); process.exit(1); }

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  model: { provider: "anthropic", model: "claude-sonnet-4-6" },
  maxWorkers: 5,
  workerMaxSteps: 20,
});

const result = await agent.run({
  prompt:
    "Compare Cursor, Windsurf, and Claude Code: pricing, features, and supported languages from each site",
});

console.log(result.text);
