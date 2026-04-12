import { FirecrawlTools } from "firecrawl-aisdk";
import type { FirecrawlToolsConfig, Toolkit } from "./types";

/**
 * Build a Toolkit from a Firecrawl API key. This is the single place where
 * agent-core meets the Firecrawl SDK — all routes share this helper.
 */
export function buildFirecrawlToolkit(
  firecrawlApiKey: string,
  config?: FirecrawlToolsConfig,
): Toolkit {
  const { systemPrompt, ...tools } = FirecrawlTools({
    apiKey: firecrawlApiKey,
    ...config,
  });

  return {
    tools,
    systemPrompt: systemPrompt ?? undefined,
    createFiltered: (enabled) => {
      const opts: Record<string, unknown> = { apiKey: firecrawlApiKey, ...config };
      if (enabled) {
        if (!enabled.includes("search")) opts.search = false;
        if (!enabled.includes("scrape")) opts.scrape = false;
        if (!enabled.includes("interact")) opts.interact = false;
      }
      const { systemPrompt: _, ...filtered } = FirecrawlTools(opts);
      return filtered;
    },
  };
}
