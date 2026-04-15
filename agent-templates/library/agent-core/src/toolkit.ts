import { FirecrawlTools, scrapeBash } from "firecrawl-aisdk";
import type { FirecrawlToolsConfig, Toolkit } from "./types";

const DEFAULT_INTERACT_TIMEOUT_MS = 60_000;

/**
 * Strip top-level null/undefined/empty-string fields from an interact tool
 * result so the LLM doesn't echo them.
 *
 * Firecrawl's /interact endpoint always returns the full response shape
 * — `{ output, result, stdout, stderr, exitCode, killed, … }` — populating
 * only the fields that apply to the mode used. In `prompt` mode, `output`
 * carries the natural-language answer and `result`/`stdout`/`stderr`/
 * `exitCode` all come back null or "". The LLM, when it composes its
 * reply, often echoes those null fields verbatim ("```\nnull\n```"), which
 * the Streamdown renderer then shows to the user as a bare "null" block.
 *
 * Cleaning the response at the tool layer stops the problem at its source
 * and keeps the model's context focused on the fields that carry data.
 * Empty arrays/objects are preserved — those can be meaningful signals
 * (e.g., `links: []` = "no links found").
 *
 * Exported for testing.
 */
export function stripInteractNulls(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Wrap a tool's `execute` so it races against a hard timeout AND strips
 * empty fields from the happy-path result. On timeout we abort the upstream
 * call via an `AbortController` and resolve with a structured error envelope
 * the UI / orchestrator can surface — instead of letting a stuck browser
 * session hang the whole agent loop. The envelope is returned as-is (not
 * stripped) so its signal fields (`timedOut`, `error`) survive.
 *
 * When `timeoutMs <= 0` the timeout is disabled but we still strip nulls,
 * so integrators who opt out of the deadline don't regress the UI fix.
 *
 * Exported for unit testing; `buildFirecrawlToolkit` is the only production
 * caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapInteractWithTimeout<T extends { execute?: (...args: any[]) => any }>(
  interactTool: T | undefined,
  timeoutMs: number,
): T | undefined {
  if (!interactTool?.execute) return interactTool;
  const original = (interactTool.execute as (input: unknown, opts?: unknown) => unknown).bind(interactTool);

  // No timeout requested — still wrap to strip nulls, otherwise the model
  // keeps echoing "null" code fences in prompt-mode replies.
  if (timeoutMs <= 0) {
    const stripOnly = async (input: unknown, opts?: unknown) =>
      stripInteractNulls(await original(input, opts));
    return { ...interactTool, execute: stripOnly } as T;
  }

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
    // Strip nulls on the happy path only — the timeout envelope is a
    // structured error we want to preserve verbatim.
    const happyPath = Promise.resolve(original(input, forwarded)).then(stripInteractNulls);
    return Promise.race([happyPath, timeoutPromise]).finally(() => {
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
