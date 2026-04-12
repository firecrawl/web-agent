/**
 * 5. Streaming — events flow as they happen.
 *
 *   npx tsx --env-file=.env examples/5-streaming.ts
 */
import { createFirecrawlAgent, streamEvents } from "../src";

const agent = await createFirecrawlAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: "anthropic:claude-sonnet-4-6",
});

const input = {
  messages: [{ role: "user" as const, content: "Top 3 Hacker News stories right now." }],
};

for await (const ev of streamEvents(agent, input)) {
  if (ev.type === "text") process.stdout.write(ev.content);
  else if (ev.type === "tool-call") console.log(`\n→ ${ev.toolName}`);
  else if (ev.type === "tool-result") console.log(`  ← ${ev.toolName}: ok`);
  else if (ev.type === "done") console.log("\n\ndone.");
  else if (ev.type === "error") console.error("\nerror:", ev.error);
}
