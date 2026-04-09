/**
 * Streaming — events arrive as the agent works.
 *
 *   npx tsx examples/streaming.ts
 */
import { createAgent } from "../agent-core/src";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: "google", model: "gemini-3-flash-preview" },
});

for await (const event of agent.stream({
  prompt: "Compare pricing for Vercel vs Netlify",
  format: "json",
})) {
  if (event.type === "tool-call") {
    console.log(`  → ${event.toolName}`, event.input);
  } else if (event.type === "done") {
    console.log("\nResult:", event.text);
  }
}
