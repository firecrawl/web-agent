/**
 * Firecrawl Agent — library starting point.
 *
 * This is your entry point. agent-core/ is a folder in your project —
 * read it, modify it, extend it.
 *
 *   npm start              run this file
 *   npm run example        run any example from examples/
 *
 * See ARCHITECTURE.md for the full guide.
 */
import { createAgent } from "./agent-core/src";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: {
    provider: (process.env.MODEL_PROVIDER ?? "google") as "google" | "anthropic" | "openai",
    model: process.env.MODEL_ID ?? "gemini-3-flash-preview",
  },
});

// --- Run a task ---

const prompt = process.argv[2] ?? "What are the top 3 stories on Hacker News right now?";

console.log(`\n→ ${prompt}\n`);

const result = await agent.run({ prompt });

console.log(result.text);

if (result.data) {
  console.log("\nData:", result.data);
}
