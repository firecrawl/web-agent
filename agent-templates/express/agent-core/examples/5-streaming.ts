/**
 * 5. Streaming - get results as they arrive
 *
 *   npx tsx examples/5-streaming.ts
 */
import { createAgent } from "../src";

if (!process.env.FIRECRAWL_API_KEY) { console.error("\n  FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev/app/api-keys\n"); process.exit(1); }

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  model: { provider: "anthropic", model: "claude-sonnet-4-6" },
});

let stepCount = 0;

for await (const event of agent.stream({
  prompt: "Find the 5 most recent YC-backed AI startups and their founders",
})) {
  if (event.type === "text") {
    process.stdout.write(event.content ?? "");
  } else if (event.type === "tool-call") {
    console.log(`\n  [${event.toolName}]`);
  } else if (event.type === "done") {
    stepCount = event.steps?.length ?? 0;
  }
}

console.log("\n\nDone. Steps:", stepCount);
