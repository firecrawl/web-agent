/**
 * Custom agent — swap model, add app prompts, configure tools.
 *
 *   npx tsx examples/custom-agent.ts
 */
import { createAgent } from "./agent-core/src";

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: "anthropic", model: "claude-sonnet-4-6" },

  // Disable tools you don't need
  firecrawlOptions: {
    interact: false, // no browser automation
    map: false,      // no site mapping
  },

  // Inject your own prompt sections
  appSections: [
    `<output_rules>
Always include a "confidence" field (high/medium/low) for each data point.
Cite the exact URL where each fact was found.
</output_rules>`,
  ],

  maxSteps: 10,
});

const result = await agent.run({
  prompt: "What is Anthropic's latest valuation and employee count?",
  format: "json",
});

console.log(result.text);
if (result.data) console.log(JSON.parse(result.data));
