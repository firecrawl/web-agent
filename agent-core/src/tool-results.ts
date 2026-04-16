/**
 * Canonical tool-result normalizer.
 *
 * Agent-core wraps Firecrawl/AI-SDK tools into LangChain tools (see
 * `adapter.ts`), which JSON.stringifies structured results so the underlying
 * model sees string ToolMessage content. Any UI or downstream consumer that
 * wants to inspect tool output must therefore:
 *   1. Accept `string | object | unknown` as raw output,
 *   2. Parse JSON strings opportunistically,
 *   3. Map vendor-specific shapes (Firecrawl's `{web, news, images}`, the
 *      `{data: {...}}` envelope, etc.) to a stable UI contract.
 *
 * This module is the single place that knows those shapes. Consumers
 * (Next, Express, Library, future clients) import `parseToolResult` and
 * render the returned discriminated union — no app-level schema knowledge
 * required.
 */

// --- Public types --------------------------------------------------------

/** A single row in a search tool response — one matched page/image/news item. */
export interface SearchResultRow {
  title: string;
  url: string;
  description: string;
  /** Full markdown content (present when scrapeOptions: { formats: ["markdown"] }). */
  markdown?: string;
  /** Query-format answer extracted for this result (scrapeOptions query format). */
  answer?: string;
  /** Favicon URL as reported by Firecrawl, if any. */
  favicon?: string;
  /** Publication / result date (news results). */
  date?: string;
  /** Thumbnail URL for image results. */
  imageUrl?: string;
  /** Source category: "web" | "news" | "images". */
  category?: "web" | "news" | "images";
  /** Result position as reported by the engine. */
  position?: number;
}

/** Parsed result from the `search` tool — the query plus matched rows. */
export interface SearchResultPayload {
  kind: "search";
  query: string;
  results: SearchResultRow[];
  /** Top-level sources the caller queried (web/news/images). */
  sources: string[];
  creditsUsed?: number;
  error?: string;
}

/**
 * Parsed result from `scrape`, `interact`, or `map` — URL-shaped tools that
 * return page content. Shared shape since they share so many fields.
 */
export interface ScrapeResultPayload {
  kind: "scrape" | "interact" | "map";
  url: string;
  /** Best-effort markdown body (falls back to serialized JSON/extract). */
  markdown: string;
  /** Direct answer for query-format scrapes. */
  answer?: string;
  /** Raw structured JSON result for scrapes requesting { type: "json" }. */
  json?: unknown;
  /** For interact tiles: the natural-language output. */
  interactOutput?: string;
  interactPrompt?: string;
  liveViewUrl?: string;
  creditsUsed?: number;
  pageTitle?: string;
  pageDescription?: string;
  pageLanguage?: string;
  statusCode?: number;
  contentType?: string;
  cacheState?: string;
  cachedAt?: string;
  proxyUsed?: string;
  scrapeId?: string;
  formats?: string[];
  scrapeQuery?: string;
  favicon?: string;
  /** For map results: discovered URLs. */
  links?: string[];
  error?: string;
}

export interface ScrapeBashLoadedPage {
  url: string;
  status: "loaded" | "empty" | "error";
  lineCount?: number;
  sandboxPath?: string;
}

/** Parsed result from `scrapeBash` loading pages into the WASM sandbox. */
export interface ScrapeBashLoadPayload {
  kind: "scrapeBashLoad";
  pages: ScrapeBashLoadedPage[];
  hint?: string;
  preview?: string;
  error?: string;
}

/** Parsed result from `bashExec` — stdout, stderr, exit code, timing. */
export interface BashResultPayload {
  kind: "bash";
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Extra stats text (scrapeBash sandbox stats). */
  context?: string;
  durationMs?: number;
  error?: string;
}

/** Fallback payload for tool names this parser doesn't recognize. */
export interface UnknownToolPayload {
  kind: "unknown";
  toolName: string;
  /** Always-present serialized input/output for debug panels. */
  error?: string;
}

export type ToolResultPayload =
  | SearchResultPayload
  | ScrapeResultPayload
  | ScrapeBashLoadPayload
  | BashResultPayload
  | UnknownToolPayload;

export interface ParseToolResult {
  payload: ToolResultPayload;
  /** Pretty-printed input JSON, suitable for a debug panel. */
  rawInput?: string;
  /** Pretty-printed output JSON or the raw string, suitable for a debug panel. */
  rawOutput?: string;
  /** True when the tool call has a usable output (complete vs still streaming). */
  isComplete: boolean;
}

// --- Normalization helpers -----------------------------------------------

/**
 * LangChain ToolMessage content is a string. Our `adapter.ts` JSON.stringifies
 * structured returns, so opportunistically parse back to object form. Passes
 * through anything that isn't JSON-shaped so caller logic can still handle
 * plain strings (e.g. Deep Agents' `task` tool returns a string).
 */
export function normalizeToolOutput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

/**
 * Serialize raw input/output for debug panels. Always returns JSON when given
 * structured values so panels can pretty-print consistently.
 */
function serialize(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** True when `output` carries a usable payload (complete, not still streaming). */
function isCompleteOutput(rawOutput: unknown): boolean {
  if (rawOutput === undefined || rawOutput === null) return false;
  if (typeof rawOutput !== "object") return true;
  return Object.keys(rawOutput as Record<string, unknown>).length > 0;
}

// --- Per-tool parsers ----------------------------------------------------

function parseSearch(
  input: Record<string, unknown>,
  output: unknown,
): SearchResultPayload {
  const query = asString(input.query) ?? "";
  const results: SearchResultRow[] = [];
  const sources: string[] = [];
  let creditsUsed: number | undefined;
  let error: string | undefined;

  const outObj = asObject(output);

  // Carry over explicit source selection from input.
  const inputSources = asArray(input.sources);
  if (inputSources) {
    for (const s of inputSources) {
      if (typeof s === "string") sources.push(s);
      else {
        const obj = asObject(s);
        const t = obj && asString(obj.type);
        if (t) sources.push(t);
      }
    }
  }

  if (outObj) {
    error = asString(outObj.error);
    creditsUsed = asNumber(outObj.creditsUsed);

    // Firecrawl's shape is `{web, news, images}` at the top, but the raw API
    // wraps it in `{data: {...}}` — check both levels.
    const levels: Record<string, unknown>[] = [outObj];
    const data = asObject(outObj.data);
    if (data) levels.push(data);

    const categories: Array<"web" | "news" | "images"> = ["web", "news", "images"];

    for (const lvl of levels) {
      for (const cat of categories) {
        const arr = asArray(lvl[cat]);
        if (!arr) continue;
        if (arr.length && !sources.includes(cat)) sources.push(cat);
        for (const raw of arr) {
          const row = toSearchRow(raw, cat);
          if (row) results.push(row);
        }
      }
      // `results` is a generic fallback some endpoints use.
      const generic = asArray(lvl.results);
      if (generic) {
        for (const raw of generic) {
          const row = toSearchRow(raw);
          if (row) results.push(row);
        }
      }
    }

  }

  // Some endpoints return a flat array at the top level (no envelope).
  // Pulled OUT of the `if (outObj)` block since asObject rejects arrays —
  // before this fix, the array fallback was unreachable for bare arrays.
  const topArr = asArray(output);
  if (topArr) {
    for (const raw of topArr) {
      const row = toSearchRow(raw);
      if (row) results.push(row);
    }
  }

  return {
    kind: "search",
    query,
    results,
    sources,
    creditsUsed,
    error,
  };
}

function toSearchRow(
  raw: unknown,
  category?: "web" | "news" | "images",
): SearchResultRow | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const url = asString(obj.url) ?? asString(obj.imageUrl);
  const title = asString(obj.title);
  if (!url && !title && !asString(obj.imageUrl)) return null;

  // Query-format results carry the extracted answer either on an `answer`
  // field or inside a nested `json`/`extract` object.
  const answer = asString(obj.answer);
  const description =
    asString(obj.description) ??
    asString(obj.snippet) ??
    answer ??
    "";

  // Firecrawl metadata often carries the favicon URL.
  const metadata = asObject(obj.metadata);
  const favicon =
    asString(obj.favicon) ??
    (metadata ? asString(metadata.favicon) : undefined);

  return {
    title: title ?? "",
    url: url ?? "",
    description,
    markdown: asString(obj.markdown) ?? answer,
    answer,
    favicon,
    date: asString(obj.date),
    imageUrl: asString(obj.imageUrl),
    category,
    position: asNumber(obj.position),
  };
}

function parseScrape(
  toolName: "scrape" | "interact" | "map",
  input: Record<string, unknown>,
  output: unknown,
): ScrapeResultPayload {
  const outObj = asObject(output) ?? {};
  const data = asObject(outObj.data);

  const markdown =
    asString(outObj.markdown) ??
    asString(outObj.content) ??
    (data && asString(data.markdown)) ??
    "";

  const json =
    outObj.json ??
    (data && data.json) ??
    outObj.extract ??
    (data && data.extract);

  const answer =
    asString(outObj.answer) ??
    (data ? asString(data.answer) : undefined);

  const metadata = asObject(outObj.metadata) ?? (data && asObject(data.metadata)) ?? null;

  const pageTitle =
    (metadata && (asString(metadata.title) ?? asString(metadata.ogTitle))) ||
    undefined;
  const pageDescription =
    (metadata &&
      (asString(metadata.description) ?? asString(metadata.ogDescription))) ||
    undefined;
  const pageLanguage = metadata ? asString(metadata.language) : undefined;
  const statusCode =
    (metadata && asNumber(metadata.statusCode)) ?? asNumber(outObj.statusCode);
  const contentType =
    (metadata && asString(metadata.contentType)) ?? asString(outObj.contentType);

  const favicon =
    asString(outObj.favicon) ??
    (metadata ? asString(metadata.favicon) : undefined);

  // Input-side metadata — formats the caller asked for, and any embedded
  // natural-language prompt (query or interact).
  const inputFormats = asArray(input.formats);
  const formats = inputFormats
    ? inputFormats.map((f) =>
        typeof f === "string"
          ? f
          : (asObject(f) && asString((f as { type?: unknown }).type)) ??
            String(f),
      )
    : undefined;
  const scrapeQuery = inputFormats
    ? (() => {
        for (const f of inputFormats) {
          const o = asObject(f);
          if (o && asString(o.prompt)) return asString(o.prompt);
        }
        return undefined;
      })()
    : asString(input.prompt);

  // Map results — surface discovered URLs. Firecrawl's /map returns
  // `{links: [...]}` or `{data: {links}}`.
  const mapLinks = asArray(outObj.links) ?? (data && asArray(data.links)) ?? null;
  const links = mapLinks
    ? mapLinks
        .map((l) => (typeof l === "string" ? l : asString(asObject(l)?.url)))
        .filter((v): v is string => !!v)
    : undefined;

  return {
    kind: toolName,
    url:
      asString(input.url) ??
      asString(outObj.url) ??
      (data ? asString(data.url) : "") ??
      "",
    markdown,
    answer,
    json: json === undefined ? undefined : json,
    interactOutput: asString(outObj.output),
    interactPrompt: asString(input.prompt),
    liveViewUrl:
      asString(outObj.liveViewUrl) ?? asString(outObj.interactiveLiveViewUrl),
    creditsUsed: asNumber(outObj.creditsUsed),
    pageTitle,
    pageDescription,
    pageLanguage,
    statusCode,
    contentType,
    cacheState: asString(outObj.cacheState),
    cachedAt: asString(outObj.cachedAt),
    proxyUsed: asString(outObj.proxyUsed),
    scrapeId: asString(outObj.scrapeId),
    formats,
    scrapeQuery,
    favicon,
    links,
    error: asString(outObj.error),
  };
}

function parseScrapeBash(
  input: Record<string, unknown>,
  output: unknown,
): ScrapeBashLoadPayload | BashResultPayload | UnknownToolPayload {
  const outObj = asObject(output);
  const isRun =
    outObj && (asString(outObj.cmd) !== undefined || asString(outObj.stdout) !== undefined);
  const pagesArr = outObj && asArray(outObj.pages);
  const isLoad = !!pagesArr || (outObj && asString(outObj.sandboxPath) !== undefined);
  const topError = outObj ? asString(outObj.error) : undefined;

  if (isRun && outObj) {
    return {
      kind: "bash",
      command: asString(outObj.cmd) ?? asString(input.command) ?? "",
      stdout: asString(outObj.stdout) ?? "",
      stderr: asString(outObj.stderr) ?? topError ?? "",
      exitCode: asNumber(outObj.exitCode) ?? (topError ? 1 : 0),
      context: asString(outObj.context),
      durationMs: asNumber(outObj.ms),
      error: topError,
    };
  }

  if (isLoad && outObj) {
    const pages: ScrapeBashLoadedPage[] = pagesArr
      ? pagesArr
          .map((p) => {
            const po = asObject(p);
            if (!po) return null;
            const status = asString(po.status);
            return {
              url: asString(po.url) ?? "",
              status:
                status === "loaded" || status === "empty" || status === "error"
                  ? (status as ScrapeBashLoadedPage["status"])
                  : "loaded",
              lineCount: asNumber(po.lineCount),
              sandboxPath: asString(po.sandboxPath),
            } as ScrapeBashLoadedPage;
          })
          .filter((v): v is ScrapeBashLoadedPage => v !== null)
      : [
          {
            url: asString(outObj.url) ?? asString(input.url) ?? "",
            status: topError
              ? "error"
              : asString(outObj.status) === "empty"
                ? "empty"
                : "loaded",
            lineCount: asNumber(outObj.lineCount),
            sandboxPath: asString(outObj.sandboxPath),
          },
        ];

    const allErrored =
      pages.length > 0 && pages.every((p) => p.status === "error");

    return {
      kind: "scrapeBashLoad",
      pages,
      hint: asString(outObj.hint),
      preview: asString(outObj.preview),
      error: topError ?? (allErrored ? "All URLs failed to load" : undefined),
    };
  }

  // In-flight load case: fall back to a load-style tile so the URL the
  // agent intended to fetch is still visible rather than collapsing to a
  // generic tile with no context.
  const intendedUrl = asString(input.url);
  const intendedUrls = asArray(input.urls);
  if (intendedUrl || intendedUrls) {
    const urls = intendedUrls
      ? intendedUrls.map((u) => asString(u) ?? "").filter(Boolean)
      : intendedUrl
        ? [intendedUrl]
        : [];
    return {
      kind: "scrapeBashLoad",
      pages: urls.map((url) => ({
        url,
        status: topError ? "error" : "loaded",
      })),
      error: topError,
    };
  }

  // In-flight command case: surface the command from input so the bash tile
  // shows up immediately (with empty stdout while waiting) instead of
  // disappearing into a generic "/scrapeBash" pill.
  const intendedCommand = asString(input.command);
  if (intendedCommand) {
    return {
      kind: "bash",
      command: intendedCommand,
      stdout: "",
      stderr: topError ?? "",
      exitCode: 0,
      error: topError,
    };
  }

  // Truly unknown (no input, no output) — let the caller dump raw I/O.
  return {
    kind: "unknown",
    toolName: "scrapeBash",
    error: topError,
  };
}

function parseBash(
  input: Record<string, unknown>,
  output: unknown,
): BashResultPayload {
  const outObj = asObject(output) ?? {};
  return {
    kind: "bash",
    command: asString(input.command) ?? asString(outObj.cmd) ?? "",
    stdout: asString(outObj.stdout) ?? "",
    stderr: asString(outObj.stderr) ?? "",
    exitCode: asNumber(outObj.exitCode) ?? 0,
    context: asString(outObj.context),
    durationMs: asNumber(outObj.ms),
    error: asString(outObj.error),
  };
}

// --- Public entrypoint ---------------------------------------------------

export interface ParseToolResultInput {
  toolName: string;
  /** Already-parsed input object from the tool part. */
  input?: unknown;
  /** Raw output — may be a string (LangChain ToolMessage content) or object. */
  output?: unknown;
}

/**
 * Normalize a single tool call's input/output into a typed, UI-friendly
 * payload. Returns `{kind: "unknown"}` for tools the normalizer doesn't
 * recognize so callers can still render a generic tile.
 */
export function parseToolResult({
  toolName,
  input,
  output,
}: ParseToolResultInput): ParseToolResult {
  const inputObj = asObject(input) ?? {};
  const normalizedOutput = normalizeToolOutput(output);
  const complete = isCompleteOutput(normalizedOutput);

  const rawInput =
    Object.keys(inputObj).length > 0 ? serialize(inputObj) : undefined;
  const rawOutput = complete ? serialize(normalizedOutput) : undefined;

  let payload: ToolResultPayload;
  switch (toolName) {
    case "search":
      payload = parseSearch(inputObj, normalizedOutput);
      break;
    case "scrape":
    case "interact":
    case "map":
      payload = parseScrape(toolName, inputObj, normalizedOutput);
      break;
    case "scrapeBash":
    case "scrape_bash":
      payload = parseScrapeBash(inputObj, normalizedOutput);
      break;
    case "bash":
    case "bashExec":
    case "bash_exec":
      payload = parseBash(inputObj, normalizedOutput);
      break;
    default:
      payload = { kind: "unknown", toolName };
  }

  return { payload, rawInput, rawOutput, isComplete: complete };
}
