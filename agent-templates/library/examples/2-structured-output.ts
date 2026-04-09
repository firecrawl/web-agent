import "dotenv/config";
import { createAgent } from "../agent-core/src";

if (!process.env.FIRECRAWL_API_KEY) { console.error("\n  FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev/app/api-keys\n"); process.exit(1); }

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  model: { provider: "anthropic", model: "claude-sonnet-4-6" },
});

const result = await agent.run({
  prompt: "Get the P/E ratio and stock price for NVIDIA, Google, and Microsoft",
  format: "json",
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        company: { type: "string" },
        ticker: { type: "string" },
        price: { type: "number" },
        peRatio: { type: "number" },
        source: { type: "string" },
      },
    },
  },
});

console.log(result.data ?? result.text);
