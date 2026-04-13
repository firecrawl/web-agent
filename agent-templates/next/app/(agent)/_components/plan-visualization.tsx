"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import StreamdownBlock from "@/components/shared/streamdown-block";
import { cn } from "@/utils/cn";

// --- Icons ---

function SearchIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" className="flex-shrink-0">
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" className="flex-shrink-0">
      <path d="M12 19.7C16.26 19.7 19.7 16.26 19.7 12S16.26 4.3 12 4.3 4.3 7.74 4.3 12s3.44 7.7 7.7 7.7zM12 19.7c-1.96 0-3.54-3.44-3.54-7.7S10.04 4.3 12 4.3s3.54 3.44 3.54 7.7-1.58 7.7-3.54 7.7zM19.5 12H4.5" stroke="currentColor" strokeLinecap="square" strokeWidth="1.5" />
    </svg>
  );
}

const FIRECRAWL_DOCS: Record<string, string> = {
  search: "https://docs.firecrawl.dev/api-reference/endpoint/search",
  scrape: "https://docs.firecrawl.dev/api-reference/endpoint/scrape",
  interact: "https://docs.firecrawl.dev/api-reference/endpoint/interact",
  skill: "https://docs.firecrawl.dev/features/agents",
};

function EndpointBadge({ type }: { type: "search" | "scrape" | "interact" | "skill" }) {
  return (
    <span
      className="text-mono-x-small text-black-alpha-48 bg-black-alpha-4 px-6 py-1 rounded-4 flex-shrink-0"
    >
      /{type}
    </span>
  );
}

function isJsonContent(content: string): boolean {
  return content.trimStart().startsWith("```json") || content.trimStart().startsWith("```\n{");
}

function extractJsonContent(content: string): string {
  const match = content.match(/^```(?:json)?\n([\s\S]*?)\n```$/m);
  return match ? match[1] : content;
}

function TerminalIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" className="flex-shrink-0">
      <path d="M4 17l6-5-6-5M12 19h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" className="flex-shrink-0">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function Favicon({ domain }: { domain: string }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      width={16} height={16} alt="" className="rounded-2 flex-shrink-0"
    />
  );
}

function getDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; }
  catch { return null; }
}

// Firecrawl and other tool backends return wordy multi-paragraph error strings
// (DNS failures, proxy tunnels, 404 walls, etc.). Condense to a single-line
// summary for the tile; the full text stays in the Raw I/O toggle.
function summarizeError(err: string | undefined): string | undefined {
  if (!err) return err;
  const trimmed = err.trim();
  if (trimmed.length <= 100) return trimmed;
  const dns = trimmed.match(/DNS resolution failed for hostname "([^"]+)"/i);
  if (dns) return `DNS failed: ${dns[1]}`;
  const tunnel = trimmed.match(/ERR_TUNNEL_CONNECTION_FAILED/i);
  if (tunnel) return "Proxy tunnel failed";
  const notFound = trimmed.match(/404|not found/i);
  if (notFound) return "Page not found (404)";
  const connRefused = trimmed.match(/ECONNREFUSED|connection refused/i);
  if (connRefused) return "Connection refused";
  const timeout = trimmed.match(/ETIMEDOUT|timed? out/i);
  if (timeout) return "Request timed out";
  // Fallback: first sentence or 100 chars.
  const firstSentence = trimmed.split(/[.!?]\s/)[0];
  return (firstSentence.length > 100 ? firstSentence.slice(0, 97) + "…" : firstSentence);
}

// @ai-sdk/langchain bridge sets UIMessage tool part `output` to the LangChain
// ToolMessage content string. Our adapter JSON-stringifies non-string results,
// so parse it back to an object here before extractors read fields like
// `markdown`, `web`, `metadata` etc. Keeps the raw string as a fallback.
function normalizeToolOutput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return raw;
  try { return JSON.parse(trimmed); } catch { return raw; }
}

// Shared chip for metadata key/value pairs on tile headers.
function MetaChip({ label, value, tone = "neutral" }: { label?: string; value: string | number; tone?: "neutral" | "success" | "warn" | "info" }) {
  const toneClass =
    tone === "success" ? "bg-accent-forest/8 text-accent-forest"
    : tone === "warn" ? "bg-accent-crimson/8 text-accent-crimson"
    : tone === "info" ? "bg-accent-bluetron/8 text-accent-bluetron"
    : "bg-black-alpha-4 text-black-alpha-56";
  return (
    <span className={cn("inline-flex items-center gap-3 px-6 py-1 rounded-4 text-mono-x-small flex-shrink-0", toneClass)}>
      {label && <span className="opacity-60">{label}</span>}
      <span>{String(value)}</span>
    </span>
  );
}

// Collapsible "Raw" panel showing the literal tool input + output JSON the
// agent sent/received. Keeps the tile compact by default.
function RawIOToggle({ input, output, toolName }: { input?: string; output?: string; toolName?: string }) {
  const [open, setOpen] = useState(false);
  if (!input && !output) return null;
  return (
    <div className="mx-14 mb-10 rounded-6 border border-border-faint bg-black-alpha-2">
      <button
        type="button"
        className="w-full flex items-center gap-6 px-10 py-6 text-left hover:bg-black-alpha-4 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span className="text-mono-x-small text-black-alpha-56">
          Raw {toolName ? `/${toolName}` : "tool"} I/O
        </span>
        <span className="flex-1" />
        <svg fill="none" height="10" viewBox="0 0 24 24" width="10" className={cn("transition-transform text-black-alpha-24", open && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border-faint px-10 py-8 flex flex-col gap-8 max-h-[420px] overflow-auto no-scrollbar">
          {input && (
            <div>
              <div className="text-mono-x-small text-black-alpha-32 mb-3">input</div>
              <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all">{input}</pre>
            </div>
          )}
          {output && (
            <div>
              <div className="text-mono-x-small text-black-alpha-32 mb-3">output</div>
              <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Search results rendering ---

interface SearchResult {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
}

function SearchResultItem({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const domain = result.url ? getDomain(result.url) : null;
  const hasMarkdown = result.markdown && result.markdown.length > 0;

  return (
    <div className="rounded-8 border border-border-faint overflow-hidden transition-all hover:border-black-alpha-16">
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left flex items-start gap-10 py-8 px-10 hover:bg-black-alpha-2 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      >
        {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
        <div className="min-w-0 flex-1">
          <div className="text-label-medium text-accent-black truncate">
            {result.title || result.url || "Untitled"}
          </div>
          {result.url && (
            <div className="text-body-small text-black-alpha-32 truncate">{result.url}</div>
          )}
          {result.description && !expanded && (
            <div className="text-body-small text-black-alpha-48 line-clamp-2 mt-2">{result.description}</div>
          )}
        </div>
        <div className="flex items-center gap-6 flex-shrink-0 mt-2">
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-bluetron hover:bg-black-alpha-4 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
          {hasMarkdown && (
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>
      </div>

      {expanded && hasMarkdown && (
        <div className="border-t border-border-faint bg-background-lighter p-12 max-h-400 overflow-auto no-scrollbar">
          <StreamdownBlock>{result.markdown!}</StreamdownBlock>
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, results, creditsUsed, sources, rawInput, rawOutput, toolName, isLatest }: { query: string; results: SearchResult[]; creditsUsed?: number; sources?: string[]; rawInput?: string; rawOutput?: string; toolName?: string; isLatest?: boolean }) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const collapsed = userExpanded !== null ? !userExpanded : !isLatest;

  return (
    <div className="my-12 border border-border-faint overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-10 px-14 py-10 w-full text-left hover:bg-black-alpha-2 transition-colors"
        onClick={() => setUserExpanded(collapsed ? true : false)}
      >
        {results.length > 0
          ? <FaviconStack urls={results.slice(0, 5).map((r) => r.url).filter((u): u is string => !!u)} />
          : <EndpointBadge type="search" />}
        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black truncate">{query}</div>
          <div className="text-body-small text-black-alpha-40 flex items-center gap-4 flex-wrap">
            <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            {sources && sources.length > 0 && (
              <span className="text-black-alpha-32">· {sources.join(", ")}</span>
            )}
          </div>
        </div>
        {typeof creditsUsed === "number" && <MetaChip label="credits" value={creditsUsed} />}
        <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
          <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", collapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!collapsed && (
        <>
          <div className="border-t border-border-faint px-14 py-8 flex flex-col gap-4">
            {results.map((r, i) => (
              <SearchResultItem key={i} result={r} />
            ))}
          </div>
          <RawIOToggle input={rawInput} output={rawOutput} toolName={toolName} />
        </>
      )}
    </div>
  );
}

// --- Scrape result rendering ---

function ScrapeResult({
  url,
  content,
  answer,
  creditsUsed,
  scrapeQuery,
  scrapeFormats,
  pageTitle,
  pageDescription,
  pageLanguage,
  statusCode,
  contentType,
  cacheState,
  cachedAt,
  proxyUsed,
  scrapeId,
  liveViewUrl,
  interactOutput,
  rawInput,
  rawOutput,
  toolName,
  isInteract,
  isLatest,
}: {
  url: string;
  content: string;
  answer?: string;
  creditsUsed?: number;
  scrapeQuery?: string;
  scrapeFormats?: string[];
  pageTitle?: string;
  pageDescription?: string;
  pageLanguage?: string;
  statusCode?: number;
  contentType?: string;
  cacheState?: string;
  cachedAt?: string;
  proxyUsed?: string;
  scrapeId?: string;
  liveViewUrl?: string;
  interactOutput?: string;
  rawInput?: string;
  rawOutput?: string;
  toolName?: string;
  isInteract?: boolean;
  isLatest?: boolean;
}) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded !== null ? userExpanded : !!isLatest;
  const [showLiveView, setShowLiveView] = useState(false);
  const domain = getDomain(url);
  const hasContent = !!(content || answer || interactOutput);

  return (
    <div className={cn("my-12 border overflow-hidden transition-all border-border-faint", !expanded && "hover:border-black-alpha-16")}>
      {/* Header - clickable */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setUserExpanded(!expanded)}
      >
        <EndpointBadge type={isInteract ? "interact" : "scrape"} />
        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black truncate">
            {pageTitle || (domain ?? url)}
          </div>
          <div className="text-body-small text-black-alpha-40 truncate">
            {scrapeQuery ? `"${scrapeQuery}"` : url}
          </div>
        </div>
        {scrapeQuery && !isInteract && (
          <span className="px-6 py-2 rounded-4 text-[10px] font-medium uppercase tracking-wider bg-gray-100 text-gray-500 flex-shrink-0">query</span>
        )}
        {domain && <Favicon domain={domain} />}
        {statusCode && statusCode >= 400 && (
          <span className="text-mono-x-small text-accent-crimson flex-shrink-0">{statusCode}</span>
        )}
        <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
          <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Collapsible body */}
      <div className={cn(
        "transition-all duration-300 overflow-hidden",
        expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
      )}>
        {/* Metadata chips — only the non-obvious ones. Success status/default
            formats already communicated by the green check and the QUERY pill. */}
        {(() => {
          const showStatus = typeof statusCode === "number" && statusCode !== 200;
          // Drop "query" — already signaled by the QUERY pill next to the title.
          const extraFormats = (scrapeFormats ?? []).filter((f) => f !== "query");
          const hasAny = showStatus || typeof creditsUsed === "number" || cacheState || proxyUsed || pageLanguage || extraFormats.length > 0;
          if (!hasAny) return null;
          return (
            <div className="mx-14 mt-10 mb-4 flex flex-wrap gap-4">
              {showStatus && (
                <MetaChip label="status" value={statusCode!} tone={statusCode! >= 400 ? "warn" : "info"} />
              )}
              {typeof creditsUsed === "number" && <MetaChip label="credits" value={creditsUsed} />}
              {cacheState && <MetaChip label="cache" value={cacheState} tone={cacheState === "HIT" || cacheState === "hit" ? "success" : "neutral"} />}
              {proxyUsed && <MetaChip label="proxy" value={proxyUsed} />}
              {pageLanguage && <MetaChip label="lang" value={pageLanguage} />}
              {extraFormats.map((f) => <MetaChip key={f} value={f} />)}
            </div>
          );
        })()}

        {pageDescription && (
          <div className="mx-14 mb-10 text-body-small text-black-alpha-48 italic">{pageDescription}</div>
        )}

        {interactOutput && (
          <div className="mx-14 mb-10 bg-accent-bluetron/[0.04] rounded-8 border border-accent-bluetron/15 p-12">
            <StreamdownBlock>{interactOutput}</StreamdownBlock>
          </div>
        )}

        {answer && (
          <div className="mx-14 mb-10 bg-black-alpha-2 rounded-8 border border-border-faint p-12">
            <StreamdownBlock>{answer}</StreamdownBlock>
          </div>
        )}

        {liveViewUrl && (
          <div className="mx-14 mb-10">
            <button
              type="button"
              className="inline-flex items-center gap-6 px-10 py-5 rounded-6 text-label-small text-accent-bluetron bg-accent-bluetron/8 hover:bg-accent-bluetron/15 transition-all"
              onClick={(e) => { e.stopPropagation(); setShowLiveView(!showLiveView); }}
            >
              <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {showLiveView ? "Hide live view" : "Show live view"}
            </button>
            {showLiveView && (
              <div className="mt-8 rounded-8 border border-accent-bluetron/20 overflow-hidden">
                <iframe src={liveViewUrl} className="w-full border-0" style={{ height: 500 }} title="Live browser view" />
              </div>
            )}
          </div>
        )}

        {content && !answer && (
          <div className="border-t border-border-faint bg-background-lighter p-14 max-h-500 overflow-auto no-scrollbar">
            {isJsonContent(content) ? (
              <StreamdownBlock>{"```json\n" + extractJsonContent(content) + "\n```"}</StreamdownBlock>
            ) : (
              <StreamdownBlock>{content}</StreamdownBlock>
            )}
          </div>
        )}

        {!hasContent && (
          <div className="px-14 pb-10">
            <div className="text-body-small text-black-alpha-24 italic">No content returned</div>
          </div>
        )}

        <RawIOToggle input={rawInput} output={rawOutput} toolName={toolName} />
      </div>
    </div>
  );
}

// --- Interact card (shows iframe while running) ---

function InteractCard({ item }: { item: TimelineItem }) {
  const isRunning = item.status !== "complete";
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const contentCollapsed = userCollapsed;
  const domain = item.url ? getDomain(item.url) : null;
  const title = item.pageTitle || domain || item.interactPrompt || item.url || "Interactive browser session";
  const subtitle = item.interactPrompt && item.interactPrompt !== item.url
    ? item.interactPrompt
    : item.url;

  useEffect(() => {
    if (isRunning) {
      setUserCollapsed(false);
      return;
    }

    setUserCollapsed(true);
    setExpanded(false);
  }, [isRunning]);

  return (
    <>
      <div className="my-12 border overflow-hidden transition-all border-border-faint">
        {/* Header -- clickable to toggle */}
        <button
          type="button"
          className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
          onClick={() => { if (!isRunning) setUserCollapsed(!contentCollapsed); }}
        >
          <EndpointBadge type="interact" />
          <div className="flex-1 min-w-0">
            <div className="text-label-medium text-accent-black truncate">
              {title}
            </div>
            <div className="text-body-small text-black-alpha-40 truncate">
              {item.scrapeQuery ? `"${item.scrapeQuery}"` : subtitle}
            </div>
          </div>
          {item.scrapeQuery && item.type !== "interact" && (
            <span className="px-6 py-2 rounded-4 text-[10px] font-medium uppercase tracking-wider bg-gray-100 text-gray-500 flex-shrink-0">query</span>
          )}
          {domain && <Favicon domain={domain} />}
          {isRunning ? (
            <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
          ) : (
            <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", !contentCollapsed && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Collapsible body */}
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          contentCollapsed ? "max-h-0 opacity-0" : "max-h-[4000px] opacity-100",
        )}>
          {/* Live view embedded in card */}
          {item.liveViewUrl && (
            <div className="border-b border-border-faint">
              <iframe
                src={item.liveViewUrl}
                className="w-full border-0"
                style={{ height: 350 }}
                title="Live browser view"
              />
            </div>
          )}

          {isRunning && (
            <div className="mx-14 my-10 border border-accent-iris/20 bg-accent-iris/6 px-12 py-10">
              <div className="flex items-center gap-8">
                <div className="min-w-0 flex-1">
                  <div className="text-label-medium text-accent-black">Browser automation in progress</div>
                  <div className="text-body-small text-black-alpha-40 truncate">
                    {item.interactPrompt || (domain ? `Working on ${domain}` : item.url || "Starting interactive session")}
                  </div>
                </div>
                <span className="text-mono-x-small text-accent-iris bg-accent-iris/10 px-6 py-2 rounded-6">live</span>
              </div>
              {!item.liveViewUrl && (
                <div className="mt-8 text-body-small text-black-alpha-32">
                  Launching browser session… live view will appear here once the session is attached.
                </div>
              )}
            </div>
          )}

          {/* Expand toggle */}
          {!isRunning && (item.interactOutput || item.content) && (
            <div className="mx-14 mb-6 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
                onClick={() => setExpanded(!expanded)}
              >
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {expanded
                    ? <><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></>
                    : <><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>
                  }
                </svg>
                {expanded ? "Compact" : "Expand"}
              </button>
            </div>
          )}

          {/* Output + content -- shown when complete */}
          {!isRunning && (item.interactOutput || item.content) && (
            <div className={cn("mx-14 mb-10", expanded ? "flex flex-col gap-8" : "flex flex-col gap-8")}>
              {item.interactOutput && (
                <div className="bg-black-alpha-2 rounded-8 border border-border-faint p-12 max-h-200 overflow-auto no-scrollbar">
                  <StreamdownBlock>{item.interactOutput.length > 500 ? item.interactOutput.slice(0, 500) + "\n\n..." : item.interactOutput}</StreamdownBlock>
                </div>
              )}
              {item.content && (
                <div className={cn(
                  "rounded-8 border border-border-faint bg-background-lighter p-14 overflow-auto no-scrollbar",
                  expanded ? "max-h-[600px]" : "max-h-300",
                )}>
                  {isJsonContent(item.content) ? (
                    <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{extractJsonContent(item.content)}</pre>
                  ) : (
                    <StreamdownBlock>{item.content}</StreamdownBlock>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- Sub-agent card ---

function SubAgentCard({ item }: { item: TimelineItem }) {
  const isRunning = item.status !== "complete";
  // Auto-expand while running (so inner calls stream visibly) and
  // auto-collapse once done (keeps the final timeline tidy).
  const [userToggled, setUserToggled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (userToggled) return;
    setExpanded(isRunning);
  }, [isRunning, userToggled]);
  const onToggle = () => { setUserToggled(true); setExpanded((v) => !v); };
  const steps = item.subagentSteps ?? [];

  // Parse sub-agent steps into mini timeline items
  const subItems = useMemo(() => {
    const result: { type: string; label: string; detail?: string; credits?: number }[] = [];
    for (const step of steps) {
      if (step.text) result.push({ type: "text", label: step.text.slice(0, 150) });
      for (let j = 0; j < step.toolCalls.length; j++) {
        const tc = step.toolCalls[j];
        const tr = step.toolResults[j];
        const out = tr?.output as Record<string, unknown> | undefined;
        const credits = typeof out?.creditsUsed === "number" ? out.creditsUsed as number : undefined;
        if (tc.toolName === "search") {
          const q = (tc.input as Record<string, unknown>).query;
          const count = Array.isArray((out as Record<string, unknown>)?.data) ? (out as Record<string, unknown>).data : undefined;
          result.push({ type: "search", label: `Search: "${q}"`, detail: count ? `${(count as unknown[]).length} results` : undefined, credits });
        } else if (tc.toolName === "scrape") {
          result.push({ type: "scrape", label: `Scrape: ${(tc.input as Record<string, unknown>).url}`, credits });
        } else if (tc.toolName === "interact") {
          const prompt = (tc.input as Record<string, unknown>).prompt ?? (tc.input as Record<string, unknown>).url;
          result.push({ type: "interact", label: `Interact: ${prompt}`, credits });
        } else if (tc.toolName === "spawnAgents" || tc.toolName === "spawnWorkers") {
          const tasks = Array.isArray((tc.input as Record<string, unknown>).tasks)
            ? ((tc.input as Record<string, unknown>).tasks as Array<Record<string, unknown>>)
            : [];
          const completed = typeof out?.completed === "number" ? out.completed as number : undefined;
          const failed = typeof out?.failed === "number" ? out.failed as number : 0;
          const taskNames = tasks
            .map((task) => String(task.id ?? "").trim())
            .filter(Boolean)
            .slice(0, 4);
          result.push({
            type: "workers",
            label: `Parallel workers: ${tasks.length || taskNames.length} task${(tasks.length || taskNames.length) === 1 ? "" : "s"}`,
            detail: [
              taskNames.length > 0 ? taskNames.join(", ") : undefined,
              completed !== undefined ? `${completed} completed` : undefined,
              failed > 0 ? `${failed} failed` : undefined,
            ].filter(Boolean).join(" · "),
          });
        } else if (tc.toolName === "bashExec" || tc.toolName === "bash_exec") {
          const cmd = String((tc.input as Record<string, unknown>).command ?? "");
          const bashLabel = (cmd.startsWith("cat <<") || cmd.includes("> /data/"))
            ? "Saving results..."
            : cmd.split("\n")[0].slice(0, 60) || "Running command...";
          result.push({ type: "bash", label: `$ ${bashLabel}` });
        } else if (tc.toolName === "map") {
          const mapUrl = String((tc.input as Record<string, unknown>).url ?? "").replace(/^https?:\/\//, "");
          result.push({ type: "other", label: `Map: ${mapUrl}` });
        } else if (tc.toolName === "extract") {
          const extractUrl = String((tc.input as Record<string, unknown>).url ?? (tc.input as Record<string, unknown>).urls ?? "").replace(/^https?:\/\//, "").slice(0, 80);
          result.push({ type: "other", label: `Extract: ${extractUrl}` });
        } else if (tc.toolName === "formatOutput") {
          const fmt = (tc.input as Record<string, unknown>).format ?? "output";
          result.push({ type: "other", label: `Formatting as ${fmt}` });
        } else {
          result.push({ type: "other", label: tc.toolName });
        }
      }
    }
    return result;
  }, [steps]);

  return (
    <div className="my-12 border border-border-faint overflow-hidden transition-all">
      {/* Header - clickable to expand */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={onToggle}
      >
        <div className="w-28 h-28 rounded-8 bg-black-alpha-4 flex-center flex-shrink-0">
          <svg fill="none" height="16" viewBox="0 0 24 24" width="16" className="text-black-alpha-56">
            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            <span className="text-label-medium text-accent-black">
              {item.skillName ?? "Sub-agent"}
            </span>
            {isRunning && (
              <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
            )}
          </div>
          {item.subagentTask && (
            <div className="text-body-small text-black-alpha-40 truncate mt-1">
              {item.subagentTask}
            </div>
          )}
          {!item.subagentTask && item.subagentDescription && (
            <div className="text-body-small text-black-alpha-32 truncate mt-1">
              {item.subagentDescription}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          {item.status === "complete" && item.exitCode !== undefined && item.exitCode > 0 && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {item.exitCode} step{item.exitCode !== 1 ? "s" : ""}
            </span>
          )}
          {item.status === "complete" && (
            <svg className="w-14 h-14 text-accent-forest" fill="none" viewBox="0 0 16 16">
              <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expanded: sub-agent's train of thought (live streaming) + tool calls */}
      {expanded && (item.subagentStreamText || (item.subagentChildren?.length ?? 0) > 0) && (
        <div className="border-t border-border-faint bg-black-alpha-2 px-14 py-8">
          {item.subagentStreamText && (
            <>
              <div className="text-label-x-small text-black-alpha-24 mb-2">Train of thought</div>
              <pre className="text-body-small text-black-alpha-56 whitespace-pre-wrap break-words mb-6 max-h-[240px] overflow-auto">
                {item.subagentStreamText}
                {isRunning && <span className="inline-block w-[6px] h-[11px] bg-heat-100 align-middle animate-pulse ml-1" />}
              </pre>
            </>
          )}
          {(item.subagentChildren?.length ?? 0) > 0 && (
            <>
              <div className="text-label-x-small text-black-alpha-24 mb-2">Sub-agent activity</div>
              <div className="flex flex-col">
                {item.subagentChildren!.map((child, j) => (
                  <ChildTile key={j} item={child} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Expanded: legacy subagent_* steps summary (kept for back-compat) */}
      {expanded && subItems.length > 0 && (
        <div className="border-t border-border-faint bg-black-alpha-2 px-14 py-10">
          <div className="flex flex-col gap-1">
            {subItems.map((si, j) => (
              <div key={j} className="flex items-start gap-8 py-3">
                <div className="w-4 h-4 rounded-full bg-black-alpha-16 mt-6 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-body-small truncate",
                    si.type === "text" ? "text-black-alpha-48" : "text-accent-black",
                  )}>
                    {si.type === "text" ? si.label : (
                      <>
                        <span className="text-mono-x-small text-black-alpha-40 bg-black-alpha-4 px-6 py-1 rounded-4 mr-4">
                          {si.type}
                        </span>
                        <span className="text-body-small text-black-alpha-56">{si.label.replace(/^(Search|Scrape|Interact|bash|Parallel workers):\s*/i, "")}</span>
                      </>
                    )}
                  </div>
                  {si.detail && <div className="text-mono-x-small text-black-alpha-24 mt-1">{si.detail}</div>}
                </div>
                {si.credits !== undefined && si.credits > 0 && (
                  <span className="text-mono-x-small text-black-alpha-24 flex-shrink-0">{si.credits}cr</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed preview of what it did — count tool calls + pages scraped */}
      {!expanded && ((item.subagentChildren?.length ?? 0) > 0 || subItems.length > 0) && (
        <div className="px-14 pb-8">
          <div className="flex flex-wrap gap-4">
            {(() => {
              type Bucket = "searches" | "pages scraped" | "bash queries" | "tasks";
              const counts: Record<Bucket | string, number> = {};
              const bump = (k: Bucket | string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };
              if (item.subagentChildren?.length) {
                for (const child of item.subagentChildren) {
                  if (child.type === "scrapeBashLoad") {
                    bump("pages scraped", child.scrapePages?.length ?? 1);
                  } else if (child.type === "bash") {
                    bump("bash queries");
                  } else if (child.type === "search") {
                    bump("searches");
                  } else if (child.type === "scrape" || child.type === "interact") {
                    bump("pages scraped");
                  } else if (child.type === "subagent") {
                    bump("tasks");
                  } else if (child.type === "text") {
                    // don't count narration
                  } else {
                    bump(child.type);
                  }
                }
              } else {
                for (const si of subItems) {
                  if (si.type === "text") continue;
                  if (si.type === "search") bump("searches");
                  else if (si.type === "scrape") bump("pages scraped");
                  else if (si.type === "bash") bump("bash queries");
                  else bump(si.type);
                }
              }
              return Object.entries(counts).map(([label, count]) => (
                <span key={label} className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
                  {count} {label}
                </span>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Final result text */}
      {expanded && item.status === "complete" && item.text && (
        <div className="border-t border-border-faint px-14 py-10">
          <div className="text-label-x-small text-black-alpha-24 mb-4">Result</div>
          <StreamdownBlock>{item.text}</StreamdownBlock>
        </div>
      )}
    </div>
  );
}

// --- Bash result rendering ---

function describeBashAction(command: string): { label: string; detail?: string; isFileOp: boolean } {
  const cmd = command.trim();
  // File writes — show as light card
  if (cmd.startsWith("cat <<") || cmd.startsWith("cat >") || cmd.includes("> /data/") || (cmd.startsWith("printf") && cmd.includes("> /data/"))) {
    const fileMatch = cmd.match(/>\s*(\/\S+)/);
    return { label: "Saving notes", detail: fileMatch?.[1], isFileOp: true };
  }
  if (cmd.startsWith("echo") && cmd.includes(">")) {
    const fileMatch = cmd.match(/>\s*(\/\S+)/);
    return { label: "Writing data", detail: fileMatch?.[1], isFileOp: true };
  }
  if (cmd.startsWith("mkdir")) return { label: "Creating directory", isFileOp: true };
  // File reads — show as light card
  if (cmd.startsWith("cat ") && !cmd.includes(">")) return { label: "Reading file", detail: cmd.replace("cat ", "").trim(), isFileOp: true };
  if (cmd.startsWith("head ") || cmd.startsWith("tail ")) return { label: "Previewing file", isFileOp: true };
  if (cmd.startsWith("wc ")) return { label: "Counting lines", isFileOp: true };
  if (cmd.startsWith("ls ")) return { label: "Listing files", isFileOp: true };
  // Data processing — show as terminal
  if (cmd.includes("jq ")) return { label: "Processing JSON", isFileOp: false };
  if (cmd.includes("awk ")) return { label: "Processing data", isFileOp: false };
  if (cmd.includes("sort") || cmd.includes("uniq")) return { label: "Sorting and filtering", isFileOp: false };
  if (cmd.includes("grep ")) return { label: "Searching data", isFileOp: false };
  if (cmd.includes("sed ")) return { label: "Transforming text", isFileOp: false };
  if (cmd.includes("cut ") || cmd.includes("tr ")) return { label: "Extracting fields", isFileOp: false };
  if (cmd.includes("paste ")) return { label: "Merging data", isFileOp: false };
  if (cmd.includes("bc") || cmd.includes("expr")) return { label: "Calculating", isFileOp: false };
  return { label: "Running command", isFileOp: false };
}

function BashResult({ command, stdout, stderr, exitCode, rawInput, rawOutput, toolName }: { command: string; stdout: string; stderr: string; exitCode: number; rawInput?: string; rawOutput?: string; toolName?: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = !!(stdout || stderr);
  const { label, detail } = describeBashAction(command);
  const singleLine = command.split("\n")[0];
  const cmdPreview = singleLine.length > 120 ? singleLine.slice(0, 117) + "…" : singleLine;
  const domains = useMemo(() => extractDomainsFromCommand(command), [command]);

  return (
      <div className="my-12 border border-border-faint overflow-hidden">
        <button
          type="button"
          className="w-full flex items-start gap-10 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {domains.length > 0
            ? <div className="mt-1"><FaviconStack urls={domains.map((d) => `https://${d}`)} /></div>
            : <span className="mt-1 text-mono-x-small text-black-alpha-32 bg-black-alpha-4 px-6 py-1 rounded-4 flex-shrink-0">$</span>}
          <div className="flex-1 min-w-0">
            <div className="text-label-medium text-accent-black">{label}</div>
            <div className="text-mono-x-small text-black-alpha-40 truncate font-mono">{cmdPreview}</div>
            {detail && <div className="text-body-small text-black-alpha-32 truncate">{detail}</div>}
          </div>
          {exitCode === 0 ? (
            <svg className="w-14 h-14 text-accent-forest flex-shrink-0 mt-2" fill="none" viewBox="0 0 16 16">
              <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="text-mono-x-small text-accent-crimson flex-shrink-0 mt-2">exit {exitCode}</span>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0 mt-2", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {expanded && (
          <>
            {/* Full command (multi-line, monospace, copyable selection) */}
            <div className="border-t border-border-faint bg-black-alpha-2 px-14 py-8">
              <div className="text-mono-x-small text-black-alpha-32 mb-3">command</div>
              <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all">{command}</pre>
            </div>

            {/* stdout/stderr — always render with a placeholder when empty so
                the user sees the response landed, just with nothing printed. */}
            <div className="border-t border-border-faint bg-black-alpha-2 px-14 py-8 max-h-[400px] overflow-auto no-scrollbar">
              <div className="text-mono-x-small text-black-alpha-32 mb-3">stdout</div>
              <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{stdout || <span className="text-black-alpha-24 italic">(empty)</span>}</pre>
              {stderr && (
                <>
                  <div className="text-mono-x-small text-accent-crimson/60 mt-8 mb-3">stderr</div>
                  <pre className="text-mono-small text-accent-crimson whitespace-pre-wrap">{stderr}</pre>
                </>
              )}
            </div>

            {/* Raw response — full tool output, always inline. Shows exitCode,
                ms, context, etc. alongside the stdout echo. No input section
                because the command block above already has it. */}
            {rawOutput && (
              <div className="border-t border-border-faint bg-black-alpha-1 px-14 py-8 max-h-[300px] overflow-auto no-scrollbar">
                <div className="text-mono-x-small text-black-alpha-32 mb-3">raw response</div>
                <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all">{rawOutput}</pre>
              </div>
            )}
          </>
        )}
      </div>
    );
}

// Thin dispatcher used to render a nested TimelineItem (a sub-agent's tool
// call) inside a SubAgentCard. Delegates to the same tile components used at
// the top level so nothing looks different — just nested.
function ChildTile({ item }: { item: TimelineItem }) {
  switch (item.type) {
    case "text":
      return (
        <div className="my-6 text-body-small text-black-alpha-48 italic">{item.text}</div>
      );
    case "search":
      return (
        <SearchResults
          query={item.query ?? ""}
          sources={item.searchSources}
          rawInput={item.rawInput}
          rawOutput={item.rawOutput}
          toolName={item.toolName}
          results={item.status === "complete" && item.searchResults?.length ? item.searchResults : []}
          creditsUsed={item.creditsUsed}
          isLatest={false}
        />
      );
    case "scrape":
      return (
        <ScrapeResult
          url={item.url ?? ""}
          content={item.content ?? ""}
          answer={item.answer}
          creditsUsed={item.creditsUsed}
          scrapeQuery={item.scrapeQuery}
          scrapeFormats={item.scrapeFormats}
          pageTitle={item.pageTitle}
          pageDescription={item.pageDescription}
          pageLanguage={item.pageLanguage}
          statusCode={item.statusCode}
          contentType={item.contentType}
          cacheState={item.cacheState}
          cachedAt={item.cachedAt}
          proxyUsed={item.proxyUsed}
          scrapeId={item.scrapeId}
          rawInput={item.rawInput}
          rawOutput={item.rawOutput}
          toolName={item.toolName}
          isInteract={false}
        />
      );
    case "scrapeBashLoad":
      return <ScrapeBashLoadCard item={item} />;
    case "bash":
      return (
        <BashResult
          command={item.command ?? ""}
          stdout={item.stdout ?? ""}
          stderr={item.stderr ?? ""}
          exitCode={item.exitCode ?? 0}
          rawInput={item.rawInput}
          rawOutput={item.rawOutput}
          toolName={item.toolName}
        />
      );
    case "skill":
      return <SkillLoad name={item.skillName ?? ""} description={item.text} instructions={item.skillInstructions} status={item.status} />;
    case "other":
      return <GenericToolTile item={item} />;
    default:
      return <GenericToolTile item={item} />;
  }
}

// --- Reusable stacked-favicon row (up to N slightly overlapping domain icons). ---

function FaviconStack({ urls, max = 5, dimErrored }: { urls: Array<string | { url: string; errored?: boolean }>; max?: number; dimErrored?: boolean }) {
  const domains = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; domain: string; errored: boolean }[] = [];
    for (const u of urls) {
      const url = typeof u === "string" ? u : u.url;
      const errored = typeof u === "string" ? false : (u.errored ?? false);
      if (!url) continue;
      const d = getDomain(url);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push({ url, domain: d, errored });
      if (out.length >= max) break;
    }
    return out;
  }, [urls, max]);

  if (domains.length === 0) return null;
  const stackCount = domains.length;
  return (
    <div
      className="flex-shrink-0 flex items-center"
      style={{ minWidth: `${12 + (stackCount - 1) * 12}px` }}
    >
      {domains.map((d, idx) => (
        <span
          key={d.domain}
          className="relative inline-flex items-center justify-center rounded-full border border-accent-white bg-accent-white"
          style={{
            width: 20,
            height: 20,
            marginLeft: idx === 0 ? 0 : -8,
            zIndex: 5 - idx,
            opacity: dimErrored && d.errored ? 0.4 : 1,
          }}
          title={d.url}
        >
          <Favicon domain={d.domain} />
        </span>
      ))}
    </div>
  );
}

// Pull domain references out of a bash command string so we can show favicons
// for commands like `cat -n cursor.com/pricing.md` or `rg -n x cursor.com/`.
function extractDomainsFromCommand(cmd: string): string[] {
  if (!cmd) return [];
  const matches = cmd.match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?=\/|\b)/gi) ?? [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (seen.has(lower)) continue;
    // Skip obvious false positives (e.g. "file.md" shouldn't look like a domain, but the
    // regex requires 2+ char TLD — exclude common file extensions as safety net).
    if (/\.(md|txt|json|csv|html|htm|js|ts|py|sh|yaml|yml|toml|log|xml|pdf)$/i.test(lower)) continue;
    seen.add(lower);
    unique.push(lower);
    if (unique.length >= 5) break;
  }
  return unique;
}

// --- scrapeBash load-mode tile: stacked favicons + domain list ---

function ScrapeBashLoadCard({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const pages = item.scrapePages ?? [];
  const isRunning = item.status === "running";
  const error = item.scrapeError;

  const domains = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; domain: string; status: ScrapeBashPage["status"]; lineCount?: number }[] = [];
    for (const p of pages) {
      const d = getDomain(p.url);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push({ url: p.url, domain: d, status: p.status, lineCount: p.lineCount });
    }
    return out;
  }, [pages]);

  const stackCount = Math.min(domains.length, 5);
  const headerDomains = domains.slice(0, 3).map((d) => d.domain);
  const remaining = domains.length - headerDomains.length;
  const title = isRunning ? "Scraping" : error ? "Scrape failed" : "Loaded";
  const subtitle = headerDomains.length > 0
    ? headerDomains.join(", ") + (remaining > 0 ? `, +${remaining} more` : "")
    : (error ?? "no pages");

  return (
    <div className="my-12 border border-border-faint overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-10 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Stacked favicons */}
        <div className="flex-shrink-0 flex items-center" style={{ minWidth: stackCount > 0 ? `${12 + (stackCount - 1) * 12}px` : 0 }}>
          {domains.slice(0, 5).map((d, idx) => (
            <span
              key={d.domain}
              className="relative inline-flex items-center justify-center rounded-full border border-accent-white bg-accent-white"
              style={{
                width: 20,
                height: 20,
                marginLeft: idx === 0 ? 0 : -8,
                zIndex: 5 - idx,
                opacity: d.status === "error" ? 0.4 : 1,
              }}
              title={d.url}
            >
              <Favicon domain={d.domain} />
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black">
            {title}
            {!isRunning && !error && pages.length > 0 && (
              <span className="text-black-alpha-32 font-normal"> · {pages.length} page{pages.length === 1 ? "" : "s"}</span>
            )}
          </div>
          <div className={cn("text-body-small truncate", error ? "text-accent-crimson" : "text-black-alpha-40")}>
            {subtitle}
          </div>
        </div>

        {isRunning ? (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        ) : error ? (
          <span className="text-mono-x-small text-accent-crimson flex-shrink-0">failed</span>
        ) : (
          <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <>
          <div className="border-t border-border-faint px-14 py-8 flex flex-col gap-4">
            {pages.map((p, i) => {
              const d = getDomain(p.url);
              return (
                <div key={i} className="flex items-center gap-8 text-body-small">
                  {d ? <Favicon domain={d} /> : <GlobeIcon />}
                  <span className={cn("truncate flex-1", p.status === "error" ? "text-accent-crimson" : "text-accent-black")}>{p.url}</span>
                  {p.lineCount !== undefined && (
                    <span className="text-mono-x-small text-black-alpha-40 flex-shrink-0">{p.lineCount} lines</span>
                  )}
                  {p.status === "error" && (
                    <span className="text-mono-x-small text-accent-crimson flex-shrink-0">error</span>
                  )}
                  {p.status === "empty" && (
                    <span className="text-mono-x-small text-black-alpha-32 flex-shrink-0">empty</span>
                  )}
                </div>
              );
            })}
          </div>
          <RawIOToggle input={item.rawInput} output={item.rawOutput} toolName={item.toolName} />
        </>
      )}
    </div>
  );
}

// --- Generic tool tile (catch-all: any tool we don't have a custom card for) ---

function GenericToolTile({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = item.toolName ?? item.text ?? "tool";
  const hasRaw = !!(item.rawInput || item.rawOutput);
  return (
    <div className="my-12 border border-border-faint overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-8 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-mono-x-small text-black-alpha-40 bg-black-alpha-4 px-6 py-1 rounded-4 flex-shrink-0">/{toolName}</span>
        <div className="flex-1 min-w-0 text-label-small text-accent-black truncate">
          {toolName}
        </div>
        {item.status === "running" ? (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        ) : (
          <svg className="w-12 h-12 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {hasRaw && (
          <svg fill="none" height="10" viewBox="0 0 24 24" width="10" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
      {expanded && <RawIOToggle input={item.rawInput} output={item.rawOutput} toolName={toolName} />}
    </div>
  );
}

// --- Skill load rendering ---

function TextBlock({ text }: { text: string }) {
  return (
    <div className="my-12">
      <StreamdownBlock>{text}</StreamdownBlock>
    </div>
  );
}

interface WorkerResultData {
  id: string;
  status: string;
  result: string;
  steps: number;
  tokens?: number;
  stepDetails?: { toolCalls: { name: string; input: string }[]; text: string }[];
}

interface WorkerLiveProgress {
  id: string;
  status: string;
  steps: number;
  currentTool?: string;
  currentInput?: string;
  tokens: number;
  liveViewUrl?: string;
  stepLog?: { tool: string; detail: string; input: Record<string, unknown> }[];
}

/** Format a tool call input string into a clean, human-readable one-liner */
function formatToolCallInput(toolName: string, input: string): string {
  try {
    const inp = typeof input === "string" && input.startsWith("{") ? JSON.parse(input) : {};
    switch (toolName) {
      case "search":
        return String(inp?.query ?? inp?.q ?? input).slice(0, 100);
      case "scrape":
        return String(inp?.url ?? "").replace(/^https?:\/\//, "");
      case "interact":
        return String(inp?.url ?? inp?.prompt ?? "").replace(/^https?:\/\//, "").slice(0, 80);
      case "map":
        return String(inp?.url ?? "").replace(/^https?:\/\//, "");
      case "extract":
        return String(inp?.url ?? inp?.urls?.[0] ?? "").replace(/^https?:\/\//, "").slice(0, 80);
      case "bashExec":
      case "bash_exec": {
        const cmd = String(inp?.command ?? "");
        if (cmd.startsWith("cat <<") || cmd.includes("> /data/")) return "Saving results...";
        return cmd.split("\n")[0].slice(0, 60) || "Running command...";
      }
      case "formatOutput":
        return `Formatting as ${inp?.format ?? "output"}`;
      case "exportSkill":
        return `Exporting skill`;
      case "spawnAgents":
      case "spawnWorkers": {
        const tasks = Array.isArray(inp?.tasks) ? inp.tasks : [];
        return `${tasks.length} parallel task${tasks.length !== 1 ? "s" : ""}`;
      }
      default:
        return toolName;
    }
  } catch {
    return toolName;
  }
}

/** Extract the first URL from a string (prompt text, detail, JSON, etc.) */
function extractUrl(text: string): string | null {
  try {
    const m = text.match(/https?:\/\/[^\s"'<>,)]+/);
    return m ? m[0].replace(/[}\]]$/, "") : null;
  } catch {
    return null;
  }
}

/** Describe a worker step in a clean, human-readable way */
function describeWorkerStep(step: { tool: string; detail: string; input: Record<string, unknown> }): {
  label: string;
  url: string | null;
  icon: "search" | "scrape" | "interact" | "bash" | "skill" | "other";
} {
  const url = extractUrl(step.detail) || extractUrl(JSON.stringify(step.input));
  switch (step.tool) {
    case "search":
      return { label: `Searched: "${step.input.query ?? step.detail}"`, url: null, icon: "search" };
    case "scrape":
      return { label: url ? (getDomain(url) ?? step.detail) : step.detail, url, icon: "scrape" };
    case "interact": {
      const prompt = String(step.input.prompt ?? step.input.instruction ?? step.input.code ?? "").slice(0, 80);
      const hostname = url ? (getDomain(url) ?? url) : null;
      const label = prompt
        ? (hostname ? `${hostname} — ${prompt}` : prompt)
        : (hostname ? `Interacting with ${hostname}` : "Interacting");
      return { label, url, icon: "interact" };
    }
    case "bashExec":
    case "bash_exec":
      return { label: step.detail || "Running command", url: null, icon: "bash" };
    case "load_skill":
      return { label: step.detail?.startsWith("Loading") ? step.detail : `Loading skill: ${step.detail || "unknown"}`, url: null, icon: "skill" };
    case "read_skill_resource":
      return { label: step.detail?.startsWith("Reading") ? step.detail : `Reading: ${step.input.file ?? step.input.resource ?? step.detail ?? "resource"}`, url: null, icon: "skill" };
    case "lookup_site_playbook":
      return { label: step.detail?.startsWith("Playbook") ? step.detail : `Playbook: ${step.input.domain ?? step.detail ?? "site"}`, url: null, icon: "skill" };
    case "formatOutput":
      return { label: "Formatting output", url: null, icon: "other" };
    case "thinking":
      return { label: "Processing...", url: null, icon: "other" };
    default:
      return { label: step.detail || step.tool, url: extractUrl(step.detail), icon: "other" };
  }
}

function WorkerCard({ id, prompt, result, workerStatus, liveProgress, stepDetails }: {
  id: string;
  prompt: string;
  result?: string;
  workerStatus: "running" | "done" | "error";
  liveProgress?: WorkerLiveProgress;
  stepDetails?: { toolCalls: { name: string; input: string }[]; text: string }[];
}) {
  const [expanded, setExpanded] = useState(false);

  // Parse the current activity into a clean description
  const lastMeaningfulStep = liveProgress?.stepLog?.filter((s) => s.tool !== "thinking").pop();
  const currentStep = lastMeaningfulStep ? describeWorkerStep(lastMeaningfulStep) : null;

  // Extract primary URL from prompt for the initial state
  const promptUrl = prompt ? extractUrl(prompt) : null;
  const promptDomain = promptUrl ? getDomain(promptUrl) : null;

  // Determine what to show as subtitle
  let subtitleDomain: string | null = null;
  let subtitleText: string;

  if (workerStatus === "done" && result) {
    // Don't show raw JSON/code blocks as subtitle
    const cleaned = result.replace(/```[\s\S]*?```/g, "").trim();
    const isRawData = cleaned.startsWith("{") || cleaned.startsWith("[") || cleaned.startsWith('"');
    subtitleText = isRawData ? "Done" : cleaned.split("\n")[0].replace(/^#+\s*/, "").slice(0, 80);
  } else if (workerStatus === "running" && currentStep) {
    subtitleDomain = currentStep.url ? getDomain(currentStep.url) : null;
    subtitleText = currentStep.label;
  } else {
    subtitleDomain = promptDomain;
    subtitleText = promptDomain ? promptUrl! : (prompt ?? "").slice(0, 80);
  }

  // Show interact indicator when actively interacting
  const isInteracting = workerStatus === "running" && currentStep?.icon === "interact";

  return (
    <div className={cn(
      "border overflow-hidden transition-all",
      isInteracting ? "border-accent-iris/30" :
      workerStatus === "error" ? "border-accent-crimson/20" : "border-border-faint hover:border-black-alpha-16",
    )}>
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 text-left hover:bg-black-alpha-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {workerStatus === "done" && (
          <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {workerStatus === "error" && (
          <svg className="w-14 h-14 text-accent-crimson flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {workerStatus === "running" && (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        )}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {subtitleDomain && <Favicon domain={subtitleDomain} />}
          <div className="min-w-0 flex-1">
            <div className="text-label-medium text-accent-black">{id}</div>
            <div className="text-body-small text-black-alpha-40 truncate">{subtitleText}</div>
          </div>
        </div>
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-border-faint">
          {/* Live browser view */}
          {liveProgress?.liveViewUrl && (
            <div className="border-b border-border-faint">
              <iframe src={liveProgress.liveViewUrl} className="w-full border-0" style={{ height: 350 }} title="Live browser view" />
            </div>
          )}
          {/* Step timeline */}
          {stepDetails && stepDetails.length > 0 && (
            <div className="px-14 py-8 flex flex-col gap-3">
              {stepDetails.map((step, si) => (
                <div key={si} className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-full bg-black-alpha-4 flex-center flex-shrink-0 mt-2 text-mono-x-small text-black-alpha-32">{si + 1}</div>
                  <div className="min-w-0 flex-1">
                    {step.toolCalls.filter((tc) => tc.name !== "lookup_site_playbook" && tc.name !== "load_skill" && tc.name !== "formatOutput" && tc.name !== "read_skill_resource").map((tc, ti) => {
                      const tcUrl = extractUrl(tc.input);
                      const tcDomain = tcUrl ? getDomain(tcUrl) : null;
                      return (
                        <div key={ti} className="flex items-center gap-4 text-black-alpha-48">
                          {tcDomain && <Favicon domain={tcDomain} />}
                          <span className="text-mono-x-small truncate">
                            {tc.name === "scrape" && tcDomain ? tcDomain : tc.name === "interact" && tcDomain ? `interact ${tcDomain}` : tc.name === "search" ? (() => { try { return JSON.parse(tc.input).query || tc.input; } catch { return tc.input; } })() : formatToolCallInput(tc.name, tc.input)}
                          </span>
                        </div>
                      );
                    })}
                    {step.text && <div className="text-body-small text-black-alpha-32 truncate mt-1">{step.text}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Final result */}
          {result && (
            <div className={cn("px-14 py-10 max-h-400 overflow-auto no-scrollbar", stepDetails?.length ? "border-t border-border-faint" : "")}>
              <StreamdownBlock>{result}</StreamdownBlock>
            </div>
          )}
          {workerStatus === "running" && !result && liveProgress?.stepLog && liveProgress.stepLog.length > 0 && (
            <div className="px-14 py-8 flex flex-col gap-3">
              {liveProgress.stepLog.filter((s) => s.tool !== "thinking" && s.tool !== "lookup_site_playbook" && s.tool !== "load_skill" && s.tool !== "formatOutput" && s.tool !== "read_skill_resource").map((step, si) => {
                const desc = describeWorkerStep(step);
                const domain = desc.url ? getDomain(desc.url) : null;
                return (
                  <div key={si} className="flex items-center gap-6">
                    {domain ? <Favicon domain={domain} /> : (
                      <span className="text-mono-x-small text-black-alpha-32 bg-black-alpha-4 px-6 py-1 rounded-4">{step.tool}</span>
                    )}
                    <div className="text-body-small text-black-alpha-48 truncate">{desc.label}</div>
                  </div>
                );
              })}
            </div>
          )}
          {workerStatus === "running" && !result && (!liveProgress?.stepLog || liveProgress.stepLog.length === 0) && (
            <div className="px-14 py-8 text-body-small text-black-alpha-24">Starting...</div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkersPanel({ item, apiBase = "" }: { item: TimelineItem; apiBase?: string }) {
  const tasks = item.workerTasks ?? [];
  const results = (item.workerResults ?? []) as WorkerResultData[];
  const isRunning = item.status === "running";
  const isDone = !isRunning && results.length > 0;
  const resultMap = new Map(results.map((r) => [r.id, r]));
  const [collapsed, setCollapsed] = useState(isDone);

  // Auto-collapse when all agents finish
  useEffect(() => {
    if (isDone) setCollapsed(true);
  }, [isDone]);

  // Poll for live progress while workers are running
  const [liveProgress, setLiveProgress] = useState<Record<string, WorkerLiveProgress>>({});
  useEffect(() => {
    if (!isRunning) return;
    const poll = () => {
      fetch(`${apiBase}/api/workers/progress`)
        .then((r) => r.json())
        .then(setLiveProgress)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="my-12 border border-border-faint overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black">
            {isRunning
              ? `${tasks.length} agents running`
              : `${results.filter((r) => r.status === "done").length} agents completed`}
          </div>
          <div className="text-body-small text-black-alpha-40 truncate">
            {isRunning
              ? tasks.map((t) => { const l = liveProgress[t.id]; return l?.currentTool ? `${t.id}: ${l.currentTool}` : t.id; }).join(", ")
              : tasks.map((t) => t.id).join(", ")}
          </div>
        </div>
        {isRunning ? (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        ) : (
          <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", collapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Nested worker cards */}
      {!collapsed && (
        <div className="border-t border-border-faint px-10 py-8 flex flex-col gap-4 bg-black-alpha-1">
          {tasks.map((task, ti) => {
            const r = resultMap.get(task.id);
            const live = liveProgress[task.id];
            return (
              <WorkerCard
                key={`${task.id}-${ti}`}
                id={task.id}
                prompt={task.prompt}
                result={r?.result}
                workerStatus={isRunning && !r ? "running" : r?.status === "error" ? "error" : "done"}
                liveProgress={isRunning && !r ? live : undefined}
                stepDetails={r?.stepDetails}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SkillLoad({ name, description, instructions, status }: { name: string; description?: string; instructions?: string; status: "running" | "complete" }) {
  const [expanded, setExpanded] = useState(false);
  const clickable = status === "complete" && !!instructions;

  return (
    <div className="my-12 border border-border-faint overflow-hidden">
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-8 px-14 py-10 text-left transition-all",
          clickable && "hover:bg-black-alpha-2 cursor-pointer",
        )}
        onClick={() => { if (clickable) setExpanded(!expanded); }}
        disabled={!clickable}
      >
        <EndpointBadge type="skill" />
        <div className="flex-1 min-w-0">
          <span className="text-label-medium text-accent-black">{name}</span>
          {description && !expanded && (
            <div className="text-body-small text-black-alpha-40 mt-1">{description}</div>
          )}
        </div>
        {status === "running" && (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        )}
        {status === "complete" && (
          <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
            <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {clickable && (
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-24 flex-shrink-0 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
      {expanded && instructions && (
        <div className="border-t border-border-faint px-14 py-10 bg-black-alpha-1 max-h-[300px] overflow-auto">
          <pre className="text-[12px] font-mono leading-[1.6] text-black-alpha-56 whitespace-pre-wrap">{instructions}</pre>
        </div>
      )}
    </div>
  );
}

// --- Data extraction ---

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

interface ScrapeBashPage {
  url: string;
  status: "loaded" | "empty" | "error";
  lineCount?: number;
  sandboxPath?: string;
}

interface TimelineItem {
  type: "text" | "search" | "scrape" | "interact" | "bash" | "scrapeBashLoad" | "skill" | "subagent" | "format" | "workers" | "other";
  // Sub-agent nested children (populated by post-process when this item is a
  // task-tool invocation and subsequent tool calls should be grouped under it).
  subagentChildren?: TimelineItem[];
  // scrapeBash load-mode
  scrapePages?: ScrapeBashPage[];
  scrapeError?: string;
  // text
  text?: string;
  // search
  query?: string;
  searchResults?: SearchResult[];
  searchSources?: string[];
  // scrape/interact
  url?: string;
  content?: string;
  answer?: string;
  creditsUsed?: number;
  scrapeQuery?: string;
  scrapeFormats?: string[];
  pageTitle?: string;
  pageDescription?: string;
  pageLanguage?: string;
  statusCode?: number;
  contentType?: string;
  cacheState?: string;
  cachedAt?: string;
  proxyUsed?: string;
  scrapeId?: string;
  liveViewUrl?: string;
  interactOutput?: string;
  interactPrompt?: string;
  // bash
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  // skill
  skillName?: string;
  skillInstructions?: string;
  // subagent
  subagentDescription?: string;
  subagentTask?: string;
  subagentSteps?: SubagentStep[];
  // format output
  formatType?: string;
  formatData?: { format: string; content: string };
  // workers
  workerTasks?: { id: string; prompt: string }[];
  workerResults?: WorkerResultData[];
  // raw input/output JSON for "View raw" panels across all tile types
  rawInput?: string;
  rawOutput?: string;
  toolName?: string;
  toolCallId?: string;
  // Server-provided authoritative sub-agent narration stream (accumulated)
  subagentStreamText?: string;
  // status
  status: "running" | "complete";
}

interface SubagentStep {
  text: string;
  toolCalls: { toolName: string; input: Record<string, unknown> }[];
  toolResults: { toolName: string; output: Record<string, unknown> }[];
}

function extractTimeline(messages: UIMessage[]): {
  items: TimelineItem[];
  subagentText: Record<string, string>;
  interactLiveView: Record<string, { liveViewUrl: string; interactiveLiveViewUrl: string | null; url: string }>;
} {
  const items: TimelineItem[] = [];
  // `itemByToolCallId` and `toolCallParent` are populated as we walk the
  // messages: the server emits `data-subagent-map` parts that tell us which
  // sub-agent tool_call_id belongs to which parent task_call_id. We hold the
  // final grouping until all items are built so ordering doesn't matter.
  const itemByToolCallId = new Map<string, TimelineItem>();
  const toolCallParent: Record<string, string> = {};
  // Per-parent-task accumulated text buffer, filled from `data-subagent-text`
  // parts emitted by the server. This is the authoritative sub-agent narration
  // — bridge-side text deltas for sub-agent messages are stripped server-side.
  const subagentText: Record<string, string> = {};
  // scrapeId → latest live-view URL, emitted from the server via
  // `data-interact-liveview` parts as soon as Firecrawl's `onSessionStart`
  // callback fires. Used to pin iframes inside interact tiles early.
  const interactLiveView: Record<string, { liveViewUrl: string; interactiveLiveViewUrl: string | null; url: string }> = {};

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      // Server-side subagent mapping — merge every payload we see.
      if ((part as { type?: string }).type === "data-subagent-map") {
        const data = (part as { data?: Record<string, string> }).data ?? {};
        for (const [childId, parentId] of Object.entries(data)) {
          toolCallParent[childId] = parentId;
        }
        continue;
      }
      // Server-side sub-agent narration — one data part per parent task, each
      // carrying the latest accumulated text.
      if ((part as { type?: string }).type === "data-subagent-text") {
        const d = (part as { data?: { parentId?: string; text?: string } }).data;
        if (d?.parentId && typeof d.text === "string") {
          subagentText[d.parentId] = d.text;
        }
        continue;
      }
      // Server-side live-view URL for an interact session, keyed by scrapeId.
      if ((part as { type?: string }).type === "data-interact-liveview") {
        const d = (part as { data?: { scrapeId?: string; liveViewUrl?: string; interactiveLiveViewUrl?: string | null; url?: string } }).data;
        if (d?.scrapeId && d.liveViewUrl) {
          interactLiveView[d.scrapeId] = {
            liveViewUrl: d.liveViewUrl,
            interactiveLiveViewUrl: d.interactiveLiveViewUrl ?? null,
            url: d.url ?? "",
          };
        }
        continue;
      }
      if (part.type === "text" && part.text.trim()) {
        // Each text part in AI SDK v6 carries an `id` tied to the AIMessage
        // that produced it. The server emits `msg:<id> → parentTaskId` in the
        // subagent map when that message came from a sub-agent graph. If it
        // matches, nest this text under that parent; otherwise render at the
        // orchestrator level as usual.
        const partId = (part as { id?: string }).id;
        const msgParent = partId ? toolCallParent[`msg:${partId}`] : undefined;
        if (typeof window !== "undefined") {
          const preview = part.text.slice(0, 50).replace(/\n/g, " ");
          // eslint-disable-next-line no-console
          console.log(`[ui] text part id=${partId ?? "<none>"} matched=${!!msgParent} "${preview}..."`);
        }
        const textItem: TimelineItem = { type: "text", text: part.text, status: "complete" };
        if (msgParent) {
          textItem.toolCallId = `text:${partId}:${items.length}`;
          toolCallParent[textItem.toolCallId] = msgParent;
        }
        items.push(textItem);
      } else if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const toolCallId = typeof p.toolCallId === "string" ? p.toolCallId as string : undefined;
        const state = (p.state ?? "") as string;
        const toolName = (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        const input = (p.input ?? p.args ?? {}) as Record<string, unknown>;
        const rawOutput = normalizeToolOutput(p.output ?? p.result);
        const output = (rawOutput ?? {}) as Record<string, unknown>;
        // Treat presence of any non-empty output as complete — the @ai-sdk/langchain
        // bridge emits tool-output-available with the string content, but if the
        // state field is missing or unfamiliar we still want the green-check render.
        const hasOutput = rawOutput !== undefined && rawOutput !== null && (typeof rawOutput !== "object" || Object.keys(rawOutput as Record<string, unknown>).length > 0);
        const isComplete = state === "output-available" || state === "result" || state === "output-error" || hasOutput;
        const status = isComplete ? "complete" as const : "running" as const;

        // Serialize raw input/output once so each tile can expose "View raw".
        // Always serialize whatever output is present — even `{}` or an
        // `{error: "..."}` envelope — so users can inspect the response.
        const rawInputStr = Object.keys(input).length > 0 ? JSON.stringify(input, null, 2) : undefined;
        const rawOutputStr = isComplete
          ? (rawOutput === undefined || rawOutput === null
              ? "(no output)"
              : typeof rawOutput === "string"
                ? rawOutput as string
                : JSON.stringify(rawOutput, null, 2))
          : undefined;

        // Record the pre-branch length so we can retroactively stamp any items
        // pushed below with this part's toolCallId (used for server-map grouping).
        const beforePushLen = items.length;

        if (toolName === "search") {
          const results: SearchResult[] = [];
          if (output && typeof output === "object") {
            const o = output as Record<string, unknown>;
            // Firecrawl's shape is usually `{web, news, images}` at the top,
            // but the raw API wraps it in `{data: {...}}` and the SDK
            // sometimes passes that through verbatim. Check both levels.
            const levels: Record<string, unknown>[] = [o];
            if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
              levels.push(o.data as Record<string, unknown>);
            }
            const combined: unknown[] = [];
            for (const lvl of levels) {
              for (const key of ["web", "news", "images", "results"]) {
                const arr = lvl[key];
                if (Array.isArray(arr)) combined.push(...arr);
              }
              const dataArr = lvl.data;
              if (Array.isArray(dataArr)) combined.push(...(dataArr as unknown[]));
            }
            if (Array.isArray(output)) combined.push(...(output as unknown[]));

            for (const r of combined) {
              const item = r as Record<string, unknown>;
              if (!item || typeof item !== "object") continue;
              if (!item.url && !item.title && !item.imageUrl) continue;
              // Query-format results carry the extracted answer either on an
              // `answer` field or inside a nested `json`/`extract` object.
              const answer = typeof item.answer === "string" ? item.answer as string : undefined;
              const desc = String(item.description ?? item.snippet ?? answer ?? "");
              results.push({
                title: String(item.title ?? ""),
                url: String(item.url ?? item.imageUrl ?? ""),
                description: desc,
                markdown: typeof item.markdown === "string"
                  ? item.markdown as string
                  : answer ?? undefined,
              });
            }
          }
          const searchCredits = typeof (output as Record<string, unknown>).creditsUsed === "number"
            ? (output as Record<string, unknown>).creditsUsed as number
            : undefined;
          // Infer which source categories were queried (web/news/images)
          const sources: string[] = [];
          const inputSources = input.sources as unknown;
          if (Array.isArray(inputSources)) {
            for (const s of inputSources) {
              if (typeof s === "string") sources.push(s);
              else if (s && typeof s === "object" && "type" in s) sources.push(String((s as { type: string }).type));
            }
          } else if (output && typeof output === "object") {
            const o = output as Record<string, unknown>;
            if (Array.isArray(o.web) && o.web.length) sources.push("web");
            if (Array.isArray(o.news) && o.news.length) sources.push("news");
            if (Array.isArray(o.images) && o.images.length) sources.push("images");
          }
          items.push({
            type: "search",
            query: String(input.query ?? ""),
            searchResults: results,
            searchSources: sources.length > 0 ? sources : undefined,
            creditsUsed: searchCredits,
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        } else if (toolName === "scrape" || toolName === "interact" || toolName === "map") {
          const outObj = output as Record<string, unknown>;
          // Firecrawl can return markdown at top level or nested in data
          let markdown = "";
          if (typeof outObj?.markdown === "string") {
            markdown = outObj.markdown as string;
          } else if (typeof outObj?.content === "string") {
            markdown = outObj.content as string;
          } else if (typeof (outObj?.data as Record<string, unknown>)?.markdown === "string") {
            markdown = (outObj.data as Record<string, unknown>).markdown as string;
          }
          // Also capture JSON/extract output as stringified content
          if (!markdown && outObj?.json) {
            markdown = "```json\n" + JSON.stringify(outObj.json, null, 2) + "\n```";
          }
          if (!markdown && outObj?.extract) {
            markdown = "```json\n" + JSON.stringify(outObj.extract, null, 2) + "\n```";
          }
          // Fallback: if nothing found, dump the raw output (excluding transport/meta fields)
          // Skip for interact -- we extract output + liveViewUrl separately
          if (!markdown && toolName !== "interact" && typeof outObj === "object" && outObj && status === "complete") {
            const STRIP_KEYS = new Set([
              "rawHtml", "html", "liveViewUrl", "interactiveLiveViewUrl",
              "scrapeId", "creditsUsed", "cacheState", "cachedAt",
              "proxyUsed", "concurrencyLimited", "statusCode", "contentType",
              "sourceURL", "url", "favicon", "metadata",
            ]);
            const preview: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(outObj)) {
              if (!STRIP_KEYS.has(k)) preview[k] = v;
            }
            const str = JSON.stringify(preview, null, 2);
            if (str.length > 10 && str !== "{}") {
              markdown = "```json\n" + str.slice(0, 5000) + "\n```";
            }
          }
          const answer = typeof outObj?.answer === "string" ? outObj.answer as string
            : typeof (outObj?.data as Record<string, unknown>)?.answer === "string" ? (outObj.data as Record<string, unknown>).answer as string
            : undefined;
          const liveViewUrl = outObj?.liveViewUrl ?? outObj?.interactiveLiveViewUrl;
          const credits = typeof outObj?.creditsUsed === "number" ? outObj.creditsUsed as number : undefined;
          // Interact output
          const interactOutput = typeof outObj?.output === "string" ? outObj.output as string : undefined;
          // Interact prompt (input.prompt)
          const interactPrompt = typeof input.prompt === "string" ? input.prompt as string : undefined;
          // Page metadata
          const meta = (outObj?.metadata ?? (outObj?.data as Record<string, unknown>)?.metadata) as Record<string, unknown> | undefined;
          const pageTitle = typeof meta?.title === "string" ? meta.title as string
            : typeof meta?.ogTitle === "string" ? meta.ogTitle as string : undefined;
          const pageDescription = typeof meta?.description === "string" ? meta.description as string
            : typeof meta?.ogDescription === "string" ? meta.ogDescription as string : undefined;
          const pageLanguage = typeof meta?.language === "string" ? meta.language as string : undefined;
          const statusCode = typeof meta?.statusCode === "number" ? meta.statusCode as number
            : typeof outObj?.statusCode === "number" ? outObj.statusCode as number : undefined;
          const contentType = typeof meta?.contentType === "string" ? meta.contentType as string
            : typeof outObj?.contentType === "string" ? outObj.contentType as string : undefined;
          const cacheState = typeof outObj?.cacheState === "string" ? outObj.cacheState as string : undefined;
          const cachedAt = typeof outObj?.cachedAt === "string" ? outObj.cachedAt as string : undefined;
          const proxyUsed = typeof outObj?.proxyUsed === "string" ? outObj.proxyUsed as string : undefined;
          const scrapeId = typeof outObj?.scrapeId === "string" ? outObj.scrapeId as string : undefined;
          // Extract input metadata
          const formats = Array.isArray(input.formats) ? (input.formats as unknown[]).map((f) => {
            if (typeof f === "string") return f;
            if (typeof f === "object" && f && "type" in f) return String((f as { type: string }).type);
            return String(f);
          }) : undefined;
          const scrapeQuery = Array.isArray(input.formats)
            ? (input.formats as unknown[]).find((f): f is { type: string; prompt: string } =>
                typeof f === "object" && f !== null && "prompt" in (f as Record<string, unknown>) && typeof (f as { prompt?: unknown }).prompt === "string"
              )?.prompt
            : interactPrompt;
          items.push({
            type: toolName === "interact" ? "interact" : "scrape",
            url: String(input.url ?? outObj?.url ?? ""),
            content: markdown,
            answer,
            creditsUsed: credits,
            scrapeQuery: scrapeQuery ? String(scrapeQuery) : undefined,
            scrapeFormats: formats,
            pageTitle,
            pageDescription,
            pageLanguage,
            statusCode,
            contentType,
            cacheState,
            cachedAt,
            proxyUsed,
            scrapeId,
            liveViewUrl: liveViewUrl ? String(liveViewUrl) : undefined,
            interactOutput: interactOutput,
            interactPrompt,
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        } else if (toolName === "bashExec" || toolName === "bash_exec") {
          items.push({
            type: "bash",
            command: String(input.command ?? ""),
            stdout: String((output as { stdout?: string }).stdout ?? ""),
            stderr: String((output as { stderr?: string }).stderr ?? ""),
            exitCode: Number((output as { exitCode?: number }).exitCode ?? 0),
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        } else if (toolName === "scrapeBash" || toolName === "scrape_bash") {
          // scrapeBash has two output shapes:
          //  - load mode: { loaded, total, pages: [{status,url,sandboxPath,lineCount}], hint }
          //  - run mode : { stdout, stderr, exitCode, cmd, ms, context }
          //  - or an error envelope: { error: "..." } / page with status: "error"
          const outObj = output as Record<string, unknown>;
          const isRun = typeof outObj?.cmd === "string" || typeof outObj?.stdout === "string";
          const isLoad = Array.isArray(outObj?.pages) || typeof outObj?.sandboxPath === "string";
          const topError = typeof outObj?.error === "string" ? outObj.error as string : undefined;
          const pageErrors = Array.isArray(outObj?.pages)
            ? (outObj.pages as Array<Record<string, unknown>>).filter((p) => p.status === "error").map((p) => String(p.url ?? "")).filter(Boolean)
            : [];

          if (isRun) {
            items.push({
              type: "bash",
              command: String(outObj.cmd ?? input.command ?? ""),
              stdout: String(outObj.stdout ?? ""),
              stderr: String(outObj.stderr ?? topError ?? ""),
              exitCode: Number(outObj.exitCode ?? (topError ? 1 : 0)),
              rawInput: rawInputStr,
              rawOutput: rawOutputStr,
              toolName,
              status,
            });
          } else if (isLoad) {
            const pages = Array.isArray(outObj.pages) ? outObj.pages as Array<Record<string, unknown>> : [];
            const inputUrlsArr = Array.isArray(input.urls) ? (input.urls as unknown[]).map(String) : undefined;
            const singleUrl = typeof outObj.url === "string" ? outObj.url as string : (typeof input.url === "string" ? input.url as string : undefined);

            // Build a normalized pages list — if Firecrawl returned per-page
            // entries, use those; otherwise fall back to single-url or the
            // input urls array so the UI can still show what was attempted.
            const pageList: ScrapeBashPage[] = pages.length > 0
              ? pages.map((p) => ({
                  url: String(p.url ?? ""),
                  status: (p.status === "loaded" || p.status === "empty" || p.status === "error") ? p.status as ScrapeBashPage["status"] : "loaded",
                  lineCount: typeof p.lineCount === "number" ? p.lineCount as number : undefined,
                  sandboxPath: typeof p.sandboxPath === "string" ? p.sandboxPath as string : undefined,
                }))
              : singleUrl
                ? [{
                    url: singleUrl,
                    status: topError ? "error" : "loaded",
                    lineCount: typeof outObj.lineCount === "number" ? outObj.lineCount as number : undefined,
                    sandboxPath: typeof outObj.sandboxPath === "string" ? outObj.sandboxPath as string : undefined,
                  }]
                : (inputUrlsArr ?? []).map((u) => ({ url: u, status: topError ? "error" as const : "loaded" as const }));

            items.push({
              type: "scrapeBashLoad",
              scrapePages: pageList,
              scrapeError: topError ?? (pageErrors.length > 0 && pageErrors.length === pages.length ? "All URLs failed to load" : undefined),
              rawInput: rawInputStr,
              rawOutput: rawOutputStr,
              toolName,
              status,
            });
          } else {
            // Unknown shape — treat error string as stderr, fall back to raw.
            items.push({
              type: "bash",
              command: String(input.command ?? input.url ?? "(scrapeBash)"),
              stdout: "",
              stderr: topError ?? "",
              exitCode: topError ? 1 : 0,
              rawInput: rawInputStr,
              rawOutput: rawOutputStr,
              toolName,
              status,
            });
          }
        } else if (toolName === "lookup_site_playbook") {
          // Site playbooks are sub-resources, not top-level skills — don't show them as cards
        } else if (toolName === "load_skill" || toolName === "read_skill_resource") {
          const skillOutput = output as { name?: string; instructions?: string; error?: string; available_site_playbooks?: string[] };
          const desc = skillOutput.instructions
            ? skillOutput.instructions.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim()
            : undefined;
          const siteHint = skillOutput.available_site_playbooks?.length
            ? ` (sites: ${skillOutput.available_site_playbooks.join(", ")})`
            : "";
          items.push({
            type: "skill",
            skillName: String(input.name ?? input.skill ?? skillOutput.name ?? "") + siteHint,
            text: desc,
            skillInstructions: skillOutput.instructions,
            status,
          });
        } else if (toolName === "spawnAgents" || toolName === "spawnWorkers") {
          const outObj = output as { results?: WorkerResultData[]; total?: number; completed?: number; failed?: number } | undefined;
          const taskList = Array.isArray((input as Record<string, unknown>).tasks)
            ? (input as Record<string, unknown>).tasks as { id: string; prompt: string }[]
            : [];
          items.push({
            type: "workers",
            workerTasks: taskList,
            workerResults: outObj?.results ?? [],
            status,
          });
        } else if (toolName === "task") {
          // Deep Agents' built-in task tool: input { description, subagent_type }
          // Output is a string (the sub-agent's final response).
          const description = typeof input.description === "string" ? input.description as string : undefined;
          const subagentType = typeof input.subagent_type === "string" ? input.subagent_type as string : undefined;
          const resultText = typeof rawOutput === "string"
            ? rawOutput
            : (rawOutput && typeof rawOutput === "object" && typeof (rawOutput as Record<string, unknown>).content === "string")
              ? (rawOutput as { content: string }).content
              : rawOutputStr;
          const firstLine = description?.split("\n")[0]?.slice(0, 120);
          items.push({
            type: "subagent",
            text: resultText,
            skillName: subagentType ?? "sub-agent",
            subagentDescription: firstLine,
            subagentTask: description,
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        } else if (toolName.startsWith("subagent_")) {
          const outObj = output as Record<string, unknown>;
          const result = typeof outObj.result === "string" ? outObj.result : undefined;
          const agentName = typeof outObj.subAgent === "string" ? outObj.subAgent : toolName.replace("subagent_", "");
          const desc = typeof outObj.description === "string" ? outObj.description : undefined;
          const task = typeof outObj.task === "string" ? outObj.task : typeof input.task === "string" ? input.task as string : undefined;
          const steps = typeof outObj.steps === "number" ? outObj.steps : 0;
          const stepDetails = Array.isArray(outObj.stepDetails) ? outObj.stepDetails as SubagentStep[] : undefined;
          items.push({
            type: "subagent",
            text: result,
            skillName: agentName,
            subagentDescription: desc,
            subagentTask: task,
            subagentSteps: stepDetails,
            exitCode: steps,
            status,
          });
        } else if (toolName === "formatOutput") {
          const fmtOutput = output as { format?: string; content?: string } | undefined;
          const fmt = (input.format as string) ?? fmtOutput?.format ?? "text";
          items.push({
            type: "format",
            formatType: fmt,
            formatData: fmtOutput?.content ? { format: fmtOutput.format ?? "text", content: fmtOutput.content } : undefined,
            status,
          });
        } else if (toolName === "write_todos") {
          // Deep Agents' built-in planning tool. Collapse repeated calls into
          // the last one — the model often rewrites the todo list each step,
          // which would otherwise produce N duplicate tiles. Keep only the most
          // recent todos state.
          const existingIdx = items.findIndex((it) => it.toolName === "write_todos");
          if (existingIdx >= 0) items.splice(existingIdx, 1);
          items.push({
            type: "other",
            text: "Updating plan",
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        } else {
          items.push({
            type: "other",
            text: toolName,
            rawInput: rawInputStr,
            rawOutput: rawOutputStr,
            toolName,
            status,
          });
        }

        // Stamp toolCallId on every item that was pushed by this branch, and
        // register the last one (usually there's only one) under the map so
        // children can look up their parent by id.
        if (toolCallId && items.length > beforePushLen) {
          for (let i = beforePushLen; i < items.length; i++) {
            if (!items[i].toolCallId) items[i].toolCallId = toolCallId;
          }
          itemByToolCallId.set(toolCallId, items[items.length - 1]);
        }
      }
    }
  }
  // Propagate liveViewUrl from completed interact items to running ones
  const knownLiveViewUrls = new Map<string, string>();
  let lastKnownLiveViewUrl: string | undefined;
  for (const item of items) {
    if (item.type === "interact" && item.liveViewUrl) {
      const domain = item.url ? getDomain(item.url) : null;
      if (domain) knownLiveViewUrls.set(domain, item.liveViewUrl);
      lastKnownLiveViewUrl = item.liveViewUrl;
    }
  }
  for (const item of items) {
    if (item.type === "interact" && !item.liveViewUrl) {
      const domain = item.url ? getDomain(item.url) : null;
      // Try same-domain first, then fall back to any prior interact's liveViewUrl
      if (domain && knownLiveViewUrls.has(domain)) {
        item.liveViewUrl = knownLiveViewUrls.get(domain);
      } else if (lastKnownLiveViewUrl) {
        item.liveViewUrl = lastKnownLiveViewUrl;
      }
    }
  }

  // Group sub-agent tool calls under their parent task tile using the
  // server-emitted mapping. If the map is empty (e.g. first render before a
  // data-subagent-map part has arrived) we fall back to an order heuristic:
  // everything between a task call and the next task/format goes under it.
  const grouped: TimelineItem[] = [];
  const hasServerMap = Object.keys(toolCallParent).length > 0;

  if (hasServerMap) {
    for (const item of items) {
      const parentId = item.toolCallId ? toolCallParent[item.toolCallId] : undefined;
      if (parentId) {
        const parent = itemByToolCallId.get(parentId);
        if (parent) {
          if (!parent.subagentChildren) parent.subagentChildren = [];
          parent.subagentChildren.push(item);
          continue;
        }
      }
      grouped.push(item);
    }
  } else {
    let currentTaskIdx = -1;
    for (const item of items) {
      const isTask = item.type === "subagent" && item.toolName === "task";
      if (isTask) {
        grouped.push(item);
        currentTaskIdx = grouped.length - 1;
        continue;
      }
      if (item.type === "format") {
        grouped.push(item);
        currentTaskIdx = -1;
        continue;
      }
      if (currentTaskIdx >= 0 && item.type !== "text") {
        const parent = grouped[currentTaskIdx];
        if (!parent.subagentChildren) parent.subagentChildren = [];
        parent.subagentChildren.push(item);
        continue;
      }
      grouped.push(item);
    }
  }

  // Attach the sub-agent text stream to each matching task tile so the card
  // can render it inside its own "train of thought" section.
  for (const g of grouped) {
    if (g.type === "subagent" && g.toolCallId && subagentText[g.toolCallId]) {
      g.subagentStreamText = subagentText[g.toolCallId];
    }
  }

  // Early-bind live-view URLs onto interact tiles by scrapeId. The server
  // emits these via the Firecrawl SDK's `onSessionStart` callback AS SOON AS
  // the browser session attaches — well before the tool's execute() resolves.
  // Walk BOTH top-level items and nested subagentChildren.
  const bindLiveView = (item: TimelineItem) => {
    if (item.type === "interact" && item.scrapeId && interactLiveView[item.scrapeId]) {
      const v = interactLiveView[item.scrapeId];
      if (!item.liveViewUrl) item.liveViewUrl = v.liveViewUrl;
    }
    if (item.subagentChildren) for (const c of item.subagentChildren) bindLiveView(c);
  };
  for (const g of grouped) bindLiveView(g);

  return { items: grouped, subagentText, interactLiveView };
}

// --- Main ---

export default function PlanVisualization({
  messages,
  isRunning,
  preloadedSkills,
  onArtifactClick,
  apiBase = "",
}: {
  messages: UIMessage[];
  isRunning: boolean;
  preloadedSkills?: string[];
  onArtifactClick?: () => void;
  apiBase?: string;
}) {
  const timeline = extractTimeline(messages).items;

  // Check if any skill load_skill calls already exist in timeline
  const loadedSkillNames = new Set(
    timeline.filter((t) => t.type === "skill").map((t) => t.skillName)
  );

  // Show preloaded skills that haven't appeared in the real timeline yet
  const pendingSkills = (preloadedSkills ?? []).filter((s) => !loadedSkillNames.has(s));

  if (timeline.length === 0 && !isRunning && pendingSkills.length === 0) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="text-body-large text-black-alpha-24">
          Agent activity will appear here
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Pre-loaded skills shown as loading before real timeline */}
      {isRunning && pendingSkills.map((skillName) => (
        <SkillLoad key={`preload-${skillName}`} name={skillName} status="running" />
      ))}

      {timeline.map((item, i) => {
        // Suppress intermediate narration ("Now let me scrape X", "Let me load more…").
        // Keep: the mermaid plan (first text with a ```mermaid fence), and the final
        // summary sentence (the last text item in the timeline, or any text that is
        // the last item before/after a format tile).
        if (item.type === "text") {
          const t = item.text ?? "";
          const hasMermaid = /```mermaid/.test(t);
          const isLastItem = i === timeline.length - 1;
          const nextItem = timeline[i + 1];
          const isBeforeFormat = nextItem?.type === "format";
          const isAfterFormat = timeline[i - 1]?.type === "format";
          const keep = hasMermaid || isLastItem || isBeforeFormat || isAfterFormat;
          if (!keep) return null;
          return <TextBlock key={i} text={t} />;
        }
        switch (item.type) {
          case "search":
            return (
              <SearchResults
                key={i}
                query={item.query!}
                sources={item.searchSources}
                rawInput={item.rawInput}
                rawOutput={item.rawOutput}
                toolName={item.toolName}
                results={item.status === "complete" && item.searchResults?.length ? item.searchResults : []}
                creditsUsed={item.creditsUsed}
                isLatest={i === timeline.length - 1}
              />
            );
          case "scrape":
            return item.status === "complete" ? (
              <ScrapeResult
                key={i}
                url={item.url!}
                content={item.content ?? ""}
                answer={item.answer}
                creditsUsed={item.creditsUsed}
                scrapeQuery={item.scrapeQuery}
                scrapeFormats={item.scrapeFormats}
                pageTitle={item.pageTitle}
                pageDescription={item.pageDescription}
                pageLanguage={item.pageLanguage}
                statusCode={item.statusCode}
                contentType={item.contentType}
                cacheState={item.cacheState}
                cachedAt={item.cachedAt}
                proxyUsed={item.proxyUsed}
                scrapeId={item.scrapeId}
                rawInput={item.rawInput}
                rawOutput={item.rawOutput}
                toolName={item.toolName}
                isInteract={(item.type as string) === "interact"}
                isLatest={i === timeline.length - 1}
              />
            ) : (
              (() => {
                const domain = item.url ? getDomain(item.url) : null;
                return (
                  <div key={i} className="my-12 border border-border-faint px-14 py-10 flex items-center gap-8 text-black-alpha-40 animate-pulse">
                    {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
                    <span className="text-label-medium flex-1">Scraping {item.url}</span>
                    <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
                  </div>
                );
              })()
            );
          case "interact":
            return <InteractCard key={i} item={item} />;
          case "bash":
            return item.status === "complete" ? (
              <BashResult key={i} command={item.command!} stdout={item.stdout!} stderr={item.stderr!} exitCode={item.exitCode!} rawInput={item.rawInput} rawOutput={item.rawOutput} toolName={item.toolName} />
            ) : (() => {
              const bashInfo = describeBashAction(item.command ?? "");
              return bashInfo.isFileOp ? (
                <div key={i} className="my-12 border border-border-faint overflow-hidden">
                  <div className="flex items-center gap-8 px-14 py-10">
                    <div className="w-24 h-24 rounded-6 bg-black-alpha-4 flex-center flex-shrink-0">
                      <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-label-small text-accent-black">{bashInfo.label}</div>
                      {bashInfo.detail && <div className="text-mono-x-small text-black-alpha-24 truncate">{bashInfo.detail}</div>}
                    </div>
                    <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
                  </div>
                </div>
              ) : (
                <div key={i} className="my-12 border border-border-faint overflow-hidden">
                  <div className="flex items-center gap-8 px-14 py-10">
                    <div className="w-24 h-24 rounded-6 bg-black-alpha-4 flex-center flex-shrink-0">
                      <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-label-small text-accent-black">{bashInfo.label}</div>
                      {bashInfo.detail && <div className="text-mono-x-small text-black-alpha-24 truncate">{bashInfo.detail}</div>}
                    </div>
                    <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
                  </div>
                </div>
              );
            })();
          case "skill":
            return <SkillLoad key={i} name={item.skillName!} description={item.text} instructions={item.skillInstructions} status={item.status} />;
          case "subagent":
            return <SubAgentCard key={i} item={item} />;
          case "format": {
            const fmtKey = item.formatType ?? "text";
            const fmtLabel: Record<string, string> = { csv: "CSV", json: "JSON", text: "Output" };
            const label = fmtLabel[fmtKey] ?? "Output";
            const isRunning = item.status === "running";

            // Derive a summary of the output content: sizes + structural
            // breadcrumbs (top-level keys for JSON, row count for CSV).
            let summary = "";
            const content = item.formatData?.content;
            if (content) {
              const bytes = content.length;
              const sizeStr = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
              if (fmtKey === "json") {
                try {
                  const parsed = JSON.parse(content);
                  const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed)
                    ? Object.keys(parsed).slice(0, 4)
                    : undefined;
                  const rows = Array.isArray(parsed) ? parsed.length : undefined;
                  if (keys && keys.length > 0) {
                    const more = Object.keys(parsed).length - keys.length;
                    summary = `${keys.join(", ")}${more > 0 ? `, +${more} more` : ""} · ${sizeStr}`;
                  } else if (rows !== undefined) {
                    summary = `${rows} row${rows === 1 ? "" : "s"} · ${sizeStr}`;
                  } else {
                    summary = sizeStr;
                  }
                } catch { summary = sizeStr; }
              } else if (fmtKey === "csv") {
                const rowCount = Math.max(0, content.split("\n").filter((l) => l.trim()).length - 1);
                summary = `${rowCount} row${rowCount === 1 ? "" : "s"} · ${sizeStr}`;
              } else {
                summary = sizeStr;
              }
            }

            const title = isRunning ? `Generating ${label}` : `${label} ready`;

            return (
              <div key={i} className="my-12 border border-border-faint overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-8 px-14 py-10 text-left hover:bg-black-alpha-2 transition-all"
                  onClick={() => onArtifactClick?.()}
                >
                  <span className="text-mono-x-small text-black-alpha-48 bg-black-alpha-4 px-6 py-1 rounded-4 flex-shrink-0">
                    /{fmtKey}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-label-medium text-accent-black">{title}</div>
                    {summary && (
                      <div className="text-body-small text-black-alpha-40 truncate">{summary}</div>
                    )}
                  </div>
                  {isRunning ? (
                    <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
                  ) : (
                    <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
                      <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            );
          }
          case "workers":
            return <WorkersPanel key={i} item={item} apiBase={apiBase} />;
          case "scrapeBashLoad":
            return <ScrapeBashLoadCard key={i} item={item} />;
          case "other":
            return <GenericToolTile key={i} item={item} />;
          default:
            return <GenericToolTile key={i} item={item} />;
        }
      })}

      {/* Running indicator — show what's happening */}
      {isRunning && (() => {
        const last = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        const lastRunning = last?.status === "running" ? last : null;

        // Workers panel handles its own running state — skip here
        if (lastRunning?.type === "workers") return null;
        if (lastRunning?.type === "interact") return null;

        // Regular tool running — show as a card tile
        let title = "Thinking";
        let subtitle = "";
        if (lastRunning?.type === "search") { title = "Searching"; subtitle = lastRunning.text?.slice(0, 80) ?? ""; }
        else if (lastRunning?.type === "scrape") { title = "Scraping"; subtitle = lastRunning.url ? (getDomain(lastRunning.url) ?? "") : ""; }
        else if (lastRunning?.type === "bash") { const b = describeBashAction(lastRunning.command ?? ""); title = b.label; subtitle = b.detail ?? ""; }
        else if (lastRunning?.type === "skill") { title = "Loading skill"; subtitle = lastRunning.skillName ?? ""; }
        else if (lastRunning?.type === "subagent") { title = "Running sub-agent"; subtitle = lastRunning.skillName ?? ""; }

        return (
          <div className="my-12 border border-border-faint overflow-hidden animate-pulse">
            <div className="flex items-center gap-8 px-14 py-10">
              <div className="flex-1 min-w-0">
                <div className="text-label-medium text-accent-black">{title}</div>
                {subtitle && <div className="text-body-small text-black-alpha-40 truncate">{subtitle}</div>}
              </div>
              <div className="w-5 h-5 rounded-full bg-heat-100 flex-shrink-0" />
            </div>
          </div>
        );
      })()}

      {/* Search results empty state while running */}
      {isRunning && timeline.length > 0 && timeline[timeline.length - 1].type === "search" && timeline[timeline.length - 1].status === "running" && (
        <div className="ml-26 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-10 py-6 px-10 animate-pulse">
              <div className="w-16 h-16 rounded-2 bg-black-alpha-8" />
              <div className="flex-1">
                <div className="h-14 bg-black-alpha-6 rounded-4 w-3/4 mb-4" />
                <div className="h-10 bg-black-alpha-4 rounded-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
