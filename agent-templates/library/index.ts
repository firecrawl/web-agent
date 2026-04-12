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
import { createFirecrawlAgent } from "./agent-core/src";

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
if (!firecrawlApiKey) {
  console.error(
    "\n  FIRECRAWL_API_KEY not set.\n  Get one at https://firecrawl.dev/app/api-keys and add it to your .env file.\n",
  );
  process.exit(1);
}

const model = process.env.MODEL ?? "anthropic:claude-sonnet-4-6";
const keys = ["FIRECRAWL_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]
  .filter((k) => process.env[k])
  .map((k) => k.replace(/_API_KEY/, "").toLowerCase());

console.log(`\n  firecrawl-agent  ${model}  keys: ${keys.join(", ")}\n`);

const agent = await createFirecrawlAgent({ firecrawlApiKey, model });

const prompt = process.argv[2] ?? "What are the top 3 stories on Hacker News right now?";
console.log(`→ ${prompt}\n`);

const result = await agent.invoke({
  messages: [{ role: "user", content: prompt }],
});

const last = result.messages[result.messages.length - 1];
console.log(typeof last.content === "string" ? last.content : JSON.stringify(last.content));
