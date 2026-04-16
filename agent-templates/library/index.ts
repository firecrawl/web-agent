import "dotenv/config";

/**
 * Firecrawl Agent — library starting point.
 *
 * This is your entry point. agent-core/ is a folder in your project —
 * read it, modify it, extend it.
 *
 *   npm start                          run with the default prompt
 *   npm start "your prompt here"        run with a CLI arg prompt
 *   echo "your prompt" | npm start      run with a stdin prompt
 *   npm run example:basic               run any example from examples/
 */
import { createAgent } from "./agent-core/src";
import type { ModelConfig } from "./agent-core/src";

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
if (!firecrawlApiKey) {
  console.error(
    "\n  FIRECRAWL_API_KEY not set.\n  Get one at https://firecrawl.dev/app/api-keys and add it to your .env file.\n  Run `npm run doctor` to verify all required env vars.\n",
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

// Warn if the selected provider's API key is missing
const providerKeyEnv: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
  "custom-openai": "CUSTOM_OPENAI_API_KEY",
};
const requiredKey = providerKeyEnv[model.provider];
if (requiredKey && !process.env[requiredKey]) {
  console.warn(`  ⚠  ${requiredKey} is not set (required for provider "${model.provider}"). Run \`npm run doctor\` for details.\n`);
}

const agent = createAgent({ firecrawlApiKey, model });

// Prompt from CLI arg, piped stdin, or the default
let prompt = process.argv[2];
if (!prompt && !process.stdin.isTTY) {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  prompt = Buffer.concat(chunks).toString("utf-8").trim();
}
prompt = prompt || "What are the top 3 stories on Hacker News right now?";
console.log(`→ ${prompt}\n`);

const result = await agent.run({ prompt });
console.log(result.text);
if (result.durationMs) {
  console.log(`\n  ${(result.durationMs / 1000).toFixed(1)}s · ${result.usage.totalTokens.toLocaleString()} tokens`);
}
