import "dotenv/config";

/**
 * Firecrawl Agent — library starting point.
 *
 * This is your entry point. agent-core/ is a folder in your project —
 * read it, modify it, extend it.
 *
 *   npm start               run this file
 *   npm run example:basic   run any example from examples/
 */
import { createAgent } from "./agent-core/src";
import type { ModelConfig } from "./agent-core/src";

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
if (!firecrawlApiKey) {
  console.error(
    "\n  FIRECRAWL_API_KEY not set.\n  Get one at https://firecrawl.dev/app/api-keys and add it to your .env file.\n",
  );
  process.exit(1);
}

const providerName = process.env.MODEL_PROVIDER ?? "google";
const modelId = process.env.MODEL_ID ?? "gemini-3-flash-preview";
const modelSpec = process.env.MODEL ?? `${providerName}:${modelId}`;
const [provider, ...rest] = modelSpec.split(":");
const model: ModelConfig = { provider: provider as ModelConfig["provider"], model: rest.join(":") };

const keyLabels: Record<string, string> = {
  FIRECRAWL_API_KEY: "firecrawl",
  ANTHROPIC_API_KEY: "anthropic",
  OPENAI_API_KEY: "openai",
  GOOGLE_GENERATIVE_AI_API_KEY: "google",
};
const keys = Object.entries(keyLabels)
  .filter(([k]) => process.env[k])
  .map(([, label]) => label);

console.log(`\n  firecrawl-agent  ${modelSpec}  keys: ${keys.join(", ")}\n`);

const agent = createAgent({ firecrawlApiKey, model });

const prompt = process.argv[2] ?? "What are the top 3 stories on Hacker News right now?";
console.log(`→ ${prompt}\n`);

const result = await agent.run({ prompt });
console.log(result.text);
if (result.durationMs) {
  console.log(`\n  ${(result.durationMs / 1000).toFixed(1)}s · ${result.usage.totalTokens.toLocaleString()} tokens`);
}
