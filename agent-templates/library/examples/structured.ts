/**
 * Structured output — extract data matching a schema.
 *
 *   npx tsx examples/structured.ts
 */
import { createAgent } from "../agent-core/src";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: "google", model: "gemini-3-flash-preview" },
});

const result = await agent.run({
  prompt: "Get the top 5 trending repositories on GitHub",
  format: "json",
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        language: { type: "string" },
        stars: { type: "number" },
        url: { type: "string" },
      },
    },
  },
});

if (result.data) {
  const repos = JSON.parse(result.data);
  for (const repo of repos) {
    console.log(`${repo.name} (${repo.language}) — ${repo.stars} stars`);
  }
}
