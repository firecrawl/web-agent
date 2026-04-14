import { FirecrawlTools, scrapeBash } from "firecrawl-aisdk";
import type { FirecrawlToolsConfig, Toolkit } from "./types";

const DEFAULT_INTERACT_TIMEOUT_MS = 60_000;

/**
 * Wrap a tool's `execute` so it races against a hard timeout. On timeout we
 * abort the upstream call via an `AbortController` and resolve with a
 * structured error envelope the UI / orchestrator can surface — instead of
 * letting a stuck browser session hang the whole agent loop.
 *
 * Exported for unit testing; `buildFirecrawlToolkit` is the only production
 * caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapInteractWithTimeout<T extends { execute?: (...args: any[]) => any }>(
  interactTool: T | undefined,
  timeoutMs: number,
): T | undefined {
  if (!interactTool?.execute || timeoutMs <= 0) return interactTool;
  const original = (interactTool.execute as (input: unknown, opts?: unknown) => unknown).bind(interactTool);
  const wrapped = (input: unknown, opts?: unknown) => {
    const controller = new AbortController();
    const optsObj = (opts ?? {}) as { abortSignal?: AbortSignal };
    const upstream = optsObj.abortSignal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const inputObj = (input ?? {}) as { url?: unknown; prompt?: unknown };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<unknown>((resolve) => {
      timer = setTimeout(() => {
        // Resolve the envelope BEFORE aborting so Promise.race sees our
        // timeout winner first. If we aborted first, an upstream `execute`
        // that resolves synchronously from its own abort listener could
        // beat us to the race.
        resolve({
          error: `Interact timed out after ${timeoutMs}ms. The browser session did not return within the limit — try a simpler prompt, break the task up, or fall back to scrape.`,
          timedOut: true,
          url: typeof inputObj.url === "string" ? inputObj.url : undefined,
          prompt: typeof inputObj.prompt === "string" ? inputObj.prompt : undefined,
        });
        controller.abort();
      }, timeoutMs);
    });

    const forwarded = { ...optsObj, abortSignal: controller.signal };
    return Promise.race([
      Promise.resolve(original(input, forwarded)),
      timeoutPromise,
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };
  return { ...interactTool, execute: wrapped } as T;
}

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
  const interactTimeoutMs = config?.interactTimeoutMs ?? DEFAULT_INTERACT_TIMEOUT_MS;

  // Strip our non-FirecrawlTools options before forwarding — they're
  // integrator-facing, not SDK-facing.
  const {
    bash: _bash,
    onInteractSessionStart: _oiss,
    interactAutoStart: _ias,
    interactTimeoutMs: _itms,
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

  if (tools.interact) {
    tools.interact = wrapInteractWithTimeout(tools.interact, interactTimeoutMs) as typeof tools.interact;
  }

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
        if (filtered.interact) {
          filtered.interact = wrapInteractWithTimeout(filtered.interact, interactTimeoutMs) as typeof filtered.interact;
        }
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
      if (filtered.interact) {
        filtered.interact = wrapInteractWithTimeout(filtered.interact, interactTimeoutMs) as typeof filtered.interact;
      }
      return filtered;
    },
  };
}
