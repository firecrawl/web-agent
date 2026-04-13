import { FirecrawlTools, scrapeBash } from "firecrawl-aisdk";
import type { FirecrawlToolsConfig, Toolkit } from "./types";

/**
 * Build a Toolkit from a Firecrawl API key. This is the single place where
 * agent-core meets the Firecrawl SDK — all routes share this helper.
 *
 * When `bash: true`, replaces `scrape` with `scrapeBash` — a single tool
 * that loads pages into a WASM sandbox and queries them with rg/grep/sed.
 * The full markdown never enters the LLM context.
 *
 * When `onInteractSessionStart` is provided, it's forwarded to the interact
 * tool (plus `autoStart` if `interactAutoStart: true`) so integrators can
 * stream `liveViewUrl` to the UI the moment a browser session attaches.
 */
export function buildFirecrawlToolkit(
  firecrawlApiKey: string,
  config?: FirecrawlToolsConfig,
): Toolkit {
  const bashMode = config?.bash ?? false;
  const onInteractSessionStart = config?.onInteractSessionStart;
  const interactAutoStart = config?.interactAutoStart ?? false;

  // Strip our non-FirecrawlTools options before forwarding — they're
  // integrator-facing, not SDK-facing.
  const {
    bash: _bash,
    onInteractSessionStart: _oiss,
    interactAutoStart: _ias,
    interact: interactConfig,
    ...fcConfig
  } = (config ?? {}) as FirecrawlToolsConfig & {
    interact?: Record<string, unknown> | false;
  };

  // Merge caller-provided interact defaults with our autoStart / callback.
  const interactOpts =
    interactConfig === false
      ? false
      : {
          ...(interactConfig ?? {}),
          ...(interactAutoStart ? { autoStart: true } : {}),
          ...(onInteractSessionStart ? { onSessionStart: onInteractSessionStart } : {}),
        };

  const { systemPrompt, ...tools } = FirecrawlTools({
    apiKey: firecrawlApiKey,
    ...fcConfig,
    interact: interactOpts as never,
  });

  if (bashMode) {
    const { scrape: _scrape, ...rest } = tools;
    const bashTools = { ...rest, scrapeBash };

    return {
      tools: bashTools as never,
      systemPrompt: systemPrompt ?? undefined,
      createFiltered: (enabled) => {
        const opts: Record<string, unknown> = {
          apiKey: firecrawlApiKey,
          ...fcConfig,
          interact: interactOpts,
        };
        if (enabled) {
          if (!enabled.includes("search")) opts.search = false;
          if (!enabled.includes("scrape") && !enabled.includes("scrapeBash")) opts.scrape = false;
          if (!enabled.includes("interact")) opts.interact = false;
        }
        const { systemPrompt: _, scrape: _s, ...filtered } = FirecrawlTools(opts);
        return { ...filtered, scrapeBash };
      },
    };
  }

  return {
    tools: tools as never,
    systemPrompt: systemPrompt ?? undefined,
    createFiltered: (enabled) => {
      const opts: Record<string, unknown> = {
        apiKey: firecrawlApiKey,
        ...fcConfig,
        interact: interactOpts,
      };
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
