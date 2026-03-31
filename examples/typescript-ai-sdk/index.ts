/**
 * Direct import of agent-core — no HTTP server needed.
 * The agent runs in-process using the Vercel AI SDK under the hood.
 */
import { createAgent } from "../../agent-core/src";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: {
    provider: "google",
    model: "gemini-2.5-flash-preview-05-20",
  },
});

async function main() {
  const result = await agent.run({
    prompt: "What is Firecrawl and what are its main features?",
  });

  console.log(result.text);
  console.log(`\nSteps: ${result.steps.length}`);
  console.log(
    `Tokens — in: ${result.usage.inputTokens}, out: ${result.usage.outputTokens}`
  );
}

main();
