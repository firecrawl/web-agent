"use client";

import { useState, useMemo, useRef } from "react";
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
    <a
      href={FIRECRAWL_DOCS[type]}
      target="_blank"
      rel="noopener noreferrer"
      className="text-mono-x-small text-black-alpha-48 bg-black-alpha-4 hover:bg-black-alpha-8 px-6 py-1 rounded-4 flex-shrink-0 transition-colors no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      /{type}
    </a>
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
      <button
        type="button"
        className="w-full text-left flex items-start gap-10 py-8 px-10 hover:bg-black-alpha-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
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
      </button>

      {expanded && hasMarkdown && (
        <div className="border-t border-border-faint bg-background-lighter p-12 max-h-400 overflow-auto no-scrollbar">
          <StreamdownBlock>{result.markdown!}</StreamdownBlock>
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, results, creditsUsed, isLatest }: { query: string; results: SearchResult[]; creditsUsed?: number; isLatest?: boolean }) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const autoCollapsed = useRef(false);

  // Auto-collapse when no longer the latest item
  if (!isLatest && !autoCollapsed.current && userToggled === null) {
    autoCollapsed.current = true;
  }

  const collapsed = userToggled !== null ? !userToggled : autoCollapsed.current;

  return (
    <div className="my-12">
      <button
        type="button"
        className="flex items-center gap-8 mb-8 text-black-alpha-40 w-full text-left hover:text-black-alpha-56 transition-colors"
        onClick={() => setUserToggled(collapsed)}
      >
        <SearchIcon />
        <EndpointBadge type="search" />
        <span className="text-label-medium flex-1">Searched: &ldquo;{query}&rdquo;</span>
        <div className="flex items-center gap-6 flex-shrink-0">
          {results.length > 0 && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
          )}
          {creditsUsed !== undefined && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {creditsUsed} credit{creditsUsed !== 1 ? "s" : ""}
            </span>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform", collapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
      <div className={cn(
        "flex flex-col gap-4 ml-26 transition-all duration-300 overflow-hidden",
        collapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100",
      )}>
        {results.map((r, i) => (
          <SearchResultItem key={i} result={r} />
        ))}
      </div>
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
  statusCode,
  liveViewUrl,
  interactOutput,
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
  statusCode?: number;
  liveViewUrl?: string;
  interactOutput?: string;
  isInteract?: boolean;
  isLatest?: boolean;
}) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const autoCollapsed = useRef(false);
  const [showLiveView, setShowLiveView] = useState(false);
  const domain = getDomain(url);
  const hasContent = !!(content || answer || interactOutput);

  if (!isLatest && !autoCollapsed.current && userToggled === null) {
    autoCollapsed.current = true;
  }

  const expanded = userToggled !== null ? userToggled : !autoCollapsed.current;

  return (
    <div className={cn("my-12 rounded-10 border overflow-hidden transition-all", expanded ? "border-heat-40 shadow-sm" : "border-border-faint hover:border-black-alpha-16")}>
      {/* Header - clickable */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => { autoCollapsed.current = expanded; setUserToggled(expanded ? false : true); }}
      >
        {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            <EndpointBadge type={isInteract ? "interact" : "scrape"} />
            <span className="text-label-medium text-accent-black truncate">
              {pageTitle || url}
            </span>
          </div>
          {pageTitle && (
            <div className="text-body-small text-black-alpha-24 truncate mt-1">{url}</div>
          )}
          {scrapeQuery && (
            <div className="text-body-small text-black-alpha-32 truncate mt-1">
              &ldquo;{scrapeQuery}&rdquo;
            </div>
          )}
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          {statusCode && statusCode !== 200 && (
            <span className={cn("text-mono-x-small px-6 py-1 rounded-4", statusCode >= 400 ? "text-accent-crimson bg-accent-crimson/8" : "text-black-alpha-24 bg-black-alpha-4")}>
              {statusCode}
            </span>
          )}
          {scrapeFormats && scrapeFormats.length > 0 && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {scrapeFormats.join(", ")}
            </span>
          )}
          {creditsUsed !== undefined && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {creditsUsed} credit{creditsUsed !== 1 ? "s" : ""}
            </span>
          )}
          {content && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {(content.length / 1000).toFixed(1)}k
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-bluetron hover:bg-black-alpha-4 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      <div className={cn(
        "transition-all duration-300 overflow-hidden",
        expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
      )}>
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
      </div>
    </div>
  );
}

// --- Interact card (shows iframe while running) ---

function InteractPIP({ url }: { url: string }) {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div className="fixed bottom-20 right-20 z-40">
        <button
          type="button"
          className="flex items-center gap-6 px-12 py-8 rounded-10 bg-accent-black text-accent-white text-label-small shadow-lg hover:opacity-90 transition-all"
          onClick={() => setMinimized(false)}
        >
          <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
          </svg>
          Live View
          <div className="w-6 h-6 rounded-full bg-heat-100 animate-pulse" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-20 right-20 z-40 rounded-12 border border-black-alpha-16 overflow-hidden bg-white"
      style={{
        width: 420,
        height: 300,
        boxShadow: "0px 16px 48px -8px rgba(0,0,0,0.2), 0px 4px 16px -2px rgba(0,0,0,0.1)",
        resize: "both",
      }}
    >
      <div className="flex items-center justify-between px-10 py-6 bg-black-alpha-2 border-b border-border-faint">
        <div className="flex items-center gap-6">
          <div className="w-6 h-6 rounded-full bg-heat-100 animate-pulse" />
          <span className="text-mono-x-small text-black-alpha-48">Live View</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-4 rounded-4 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
            onClick={() => setMinimized(true)}
            title="Minimize"
          >
            <svg fill="none" height="10" viewBox="0 0 24 24" width="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
        </div>
      </div>
      <iframe
        src={url}
        className="w-full border-0"
        style={{ height: "calc(100% - 32px)" }}
        title="Live browser view"
      />
    </div>
  );
}

function InteractCard({ item }: { item: TimelineItem }) {
  const isRunning = item.status !== "complete";
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const contentCollapsed = userCollapsed;
  const domain = item.url ? getDomain(item.url) : null;

  return (
    <>
      {/* PIP live viewer in corner */}
      {isRunning && item.liveViewUrl && (
        <InteractPIP url={item.liveViewUrl} />
      )}

      <div className={cn(
        "my-12 rounded-10 border overflow-hidden transition-all",
        isRunning ? "border-heat-40 shadow-sm" : "border-border-faint",
      )}>
        {/* Header -- clickable to toggle */}
        <button
          type="button"
          className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
          onClick={() => { if (!isRunning) setUserCollapsed(!contentCollapsed); }}
        >
          {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-6">
              <EndpointBadge type="interact" />
              {isRunning && (
                <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
              )}
              <span className="text-label-medium text-accent-black truncate">
                {item.pageTitle || item.url}
              </span>
            </div>
            {item.scrapeQuery && (
              <div className="text-body-small text-black-alpha-32 truncate mt-1">
                &ldquo;{item.scrapeQuery}&rdquo;
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            {item.creditsUsed !== undefined && (
              <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
                {item.creditsUsed} credit{item.creditsUsed !== 1 ? "s" : ""}
              </span>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            )}
            {!isRunning && (
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", contentCollapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </div>
        </button>

        {/* Collapsible body */}
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          contentCollapsed ? "max-h-0 opacity-0" : "max-h-[4000px] opacity-100",
        )}>
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
                <div className="bg-black-alpha-2 rounded-8 border border-border-faint p-12">
                  <StreamdownBlock>{item.interactOutput}</StreamdownBlock>
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
  const [expanded, setExpanded] = useState(false);
  const isRunning = item.status !== "complete";
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
        } else if (tc.toolName === "bashExec" || tc.toolName === "bash_exec") {
          result.push({ type: "bash", label: `$ ${(tc.input as Record<string, unknown>).command}` });
        } else {
          result.push({ type: "other", label: tc.toolName });
        }
      }
    }
    return result;
  }, [steps]);

  return (
    <div className={cn(
      "my-12 rounded-10 border overflow-hidden transition-all",
      isRunning ? "border-accent-amethyst/30 shadow-sm" : "border-accent-amethyst/15",
    )}>
      {/* Header - clickable to expand */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-accent-amethyst/[0.02] transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-28 h-28 rounded-8 bg-accent-amethyst/10 flex-center flex-shrink-0">
          <svg fill="none" height="16" viewBox="0 0 24 24" width="16" className="text-accent-amethyst">
            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            <span className="text-label-medium text-accent-black">
              {item.skillName ?? "Sub-agent"}
            </span>
            {isRunning && (
              <div className="w-5 h-5 rounded-full bg-accent-amethyst animate-pulse flex-shrink-0" />
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

      {/* Expanded: show internal tool calls timeline */}
      {expanded && subItems.length > 0 && (
        <div className="border-t border-accent-amethyst/10 bg-accent-amethyst/[0.02] px-14 py-10">
          <div className="flex flex-col gap-1">
            {subItems.map((si, j) => (
              <div key={j} className="flex items-start gap-8 py-3">
                <div className="w-4 h-4 rounded-full bg-accent-amethyst/30 mt-6 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-body-small truncate",
                    si.type === "text" ? "text-black-alpha-48" : "text-accent-black",
                  )}>
                    {si.type === "text" ? si.label : (
                      <>
                        <span className={cn(
                          "text-mono-x-small px-6 py-1 rounded-4 mr-4",
                          si.type === "search" ? "text-heat-100 bg-heat-4" :
                          si.type === "scrape" ? "text-accent-forest bg-accent-forest/8" :
                          si.type === "interact" ? "text-accent-amethyst bg-accent-amethyst/8" :
                          si.type === "bash" ? "text-black-alpha-48 bg-black-alpha-4" :
                          "text-black-alpha-40 bg-black-alpha-4"
                        )}>
                          {si.type}
                        </span>
                        <span className="text-body-small text-black-alpha-56">{si.label.replace(/^(Search|Scrape|Interact|bash):\s*/i, "")}</span>
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

      {/* Collapsed preview of what it did */}
      {!expanded && subItems.length > 0 && (
        <div className="px-14 pb-8">
          <div className="flex flex-wrap gap-4">
            {(() => {
              const counts: Record<string, number> = {};
              for (const si of subItems) {
                if (si.type !== "text") counts[si.type] = (counts[si.type] || 0) + 1;
              }
              return Object.entries(counts).map(([type, count]) => (
                <span key={type} className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
                  {count} {type}{count !== 1 ? (type === "search" ? "es" : "s") : ""}
                </span>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Final result text */}
      {expanded && item.status === "complete" && item.text && (
        <div className="border-t border-accent-amethyst/10 px-14 py-10">
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

function BashResult({ command, stdout, stderr, exitCode }: { command: string; stdout: string; stderr: string; exitCode: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = !!(stdout || stderr);
  const { label, detail, isFileOp } = describeBashAction(command);

  // File operations (save, read, mkdir) — light card style
  if (isFileOp) {
    return (
      <div className={cn("my-12 rounded-10 border overflow-hidden transition-all", expanded ? "border-black-alpha-16 shadow-sm" : "border-border-faint hover:border-black-alpha-16")}>
        <button
          type="button"
          className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
          onClick={() => hasOutput ? setExpanded(!expanded) : undefined}
        >
          <div className="w-24 h-24 rounded-6 bg-black-alpha-4 flex-center flex-shrink-0">
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-label-small text-accent-black">{label}</div>
            {detail && <div className="text-mono-x-small text-black-alpha-24 truncate">{detail}</div>}
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            {exitCode === 0 && (
              <svg className="w-14 h-14 text-accent-forest" fill="none" viewBox="0 0 16 16">
                <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {hasOutput && (
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </div>
        </button>
        {expanded && hasOutput && (
          <div className="border-t border-border-faint bg-black-alpha-2 px-14 py-10 max-h-300 overflow-auto no-scrollbar">
            <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{stdout}</pre>
            {stderr && <pre className="text-mono-small text-accent-crimson whitespace-pre-wrap mt-6">{stderr}</pre>}
          </div>
        )}
      </div>
    );
  }

  // Data processing commands — same light card style
  return (
    <div className={cn("my-12 rounded-10 border overflow-hidden transition-all", expanded ? "border-black-alpha-16 shadow-sm" : "border-border-faint hover:border-black-alpha-16")}>
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-24 h-24 rounded-6 bg-black-alpha-4 flex-center flex-shrink-0">
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-label-small text-accent-black">{label}</div>
          {detail && <div className="text-mono-x-small text-black-alpha-24 truncate">{detail}</div>}
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          {exitCode !== 0 && (
            <span className="text-mono-x-small text-accent-crimson bg-accent-crimson/8 px-6 py-1 rounded-4">
              exit {exitCode}
            </span>
          )}
          {exitCode === 0 && (
            <svg className="w-14 h-14 text-accent-forest" fill="none" viewBox="0 0 16 16">
              <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-faint px-14 py-10 max-h-300 overflow-auto no-scrollbar">
          <StreamdownBlock>{[
            "```bash",
            command,
            "```",
            stdout ? ["```", stdout, "```"].join("\n") : "",
            stderr ? ["```", "# stderr", stderr, "```"].join("\n") : "",
            !hasOutput ? "*No output*" : "",
          ].filter(Boolean).join("\n\n")}</StreamdownBlock>
        </div>
      )}
    </div>
  );
}

// --- Skill load rendering ---

const SHORT_TEXT_THRESHOLD = 200;

function TextBlock({ text, isLatest }: { text: string; isLatest: boolean }) {
  const isShort = text.length < SHORT_TEXT_THRESHOLD;
  const [collapsed, setCollapsed] = useState(!isLatest && !isShort);
  const preview = useMemo(() => {
    // Clean labels for code-fenced content
    const trimmed = text.trim();
    if (trimmed.startsWith("```json")) return "JSON";
    if (trimmed.startsWith("```csv")) return "CSV";
    if (trimmed.startsWith("```markdown") || trimmed.startsWith("```md")) return "Markdown";
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).split("\n")[0].trim();
      return lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : "Response";
    }
    const firstLine = text.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? text.slice(0, 100);
    return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
  }, [text]);

  if (isShort) {
    return (
      <div className="my-12">
        <StreamdownBlock>{text}</StreamdownBlock>
      </div>
    );
  }

  return (
    <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg fill="none" height="16" viewBox="0 0 24 24" width="16" className="flex-shrink-0 text-black-alpha-32">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
        <span className="flex-1 min-w-0 text-body-small text-black-alpha-48 truncate">
          {collapsed ? preview : "Response"}
        </span>
        <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4 flex-shrink-0">
          {(text.length / 1000).toFixed(1)}k
        </span>
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", collapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={cn(
        "transition-all duration-300 overflow-hidden",
        collapsed ? "max-h-0 opacity-0" : "max-h-[4000px] opacity-100",
      )}>
        <div className="border-t border-border-faint p-14 max-h-[600px] overflow-auto no-scrollbar">
          <StreamdownBlock>{text}</StreamdownBlock>
        </div>
      </div>
    </div>
  );
}

function SkillLoad({ name, description, status }: { name: string; description?: string; status: "running" | "complete" }) {
  return (
    <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
      <div className="flex items-center gap-8 px-14 py-10">
        <EndpointBadge type="skill" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            <span className="text-label-medium text-accent-black">{name}</span>
            {status === "running" && (
              <div className="w-4 h-4 rounded-full bg-accent-forest animate-pulse" />
            )}
            {status === "complete" && (
              <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
                <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          {description && (
            <div className="text-body-small text-black-alpha-40 mt-1">{description}</div>
          )}
        </div>
        <SkillIcon />
      </div>
    </div>
  );
}

// --- Data extraction ---

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

interface TimelineItem {
  type: "text" | "search" | "scrape" | "interact" | "bash" | "skill" | "subagent" | "format" | "other";
  // text
  text?: string;
  // search
  query?: string;
  searchResults?: SearchResult[];
  // scrape/interact
  url?: string;
  content?: string;
  answer?: string;
  creditsUsed?: number;
  scrapeQuery?: string;
  scrapeFormats?: string[];
  pageTitle?: string;
  statusCode?: number;
  liveViewUrl?: string;
  interactOutput?: string;
  // bash
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  // skill
  skillName?: string;
  // subagent
  subagentDescription?: string;
  subagentTask?: string;
  subagentSteps?: SubagentStep[];
  // format output
  formatType?: string;
  formatData?: { format: string; content: string };
  // status
  status: "running" | "complete";
}

interface SubagentStep {
  text: string;
  toolCalls: { toolName: string; input: Record<string, unknown> }[];
  toolResults: { toolName: string; output: Record<string, unknown> }[];
}

function extractTimeline(messages: UIMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (part.type === "text" && part.text.trim()) {
        items.push({ type: "text", text: part.text, status: "complete" });
      } else if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const state = (p.state ?? "") as string;
        const toolName = (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        const input = (p.input ?? p.args ?? {}) as Record<string, unknown>;
        const output = (p.output ?? p.result ?? {}) as Record<string, unknown>;
        const isComplete = state === "output-available" || state === "result" || state === "output-error";
        const status = isComplete ? "complete" as const : "running" as const;



        if (toolName === "search") {
          const results: SearchResult[] = [];
          if (output && typeof output === "object") {
            const o = output as Record<string, unknown>;
            // Find the results array -- Firecrawl returns { web: [...] } or { data: [...] }
            let data: unknown[] | undefined;
            if (Array.isArray(o.web)) data = o.web as unknown[];
            else if (Array.isArray(o.data)) data = o.data as unknown[];
            else if (Array.isArray(o.results)) data = o.results as unknown[];
            else if (Array.isArray(output)) data = output as unknown[];

            if (data) {
              for (const r of data) {
                const item = r as Record<string, unknown>;
                if (item && typeof item === "object" && (item.url || item.title)) {
                  results.push({
                    title: String(item.title ?? ""),
                    url: String(item.url ?? ""),
                    description: String(item.description ?? item.snippet ?? ""),
                    markdown: typeof item.markdown === "string" ? item.markdown : undefined,
                  });
                }
              }
            }
          }
          const searchCredits = typeof (output as Record<string, unknown>).creditsUsed === "number"
            ? (output as Record<string, unknown>).creditsUsed as number
            : undefined;
          items.push({
            type: "search",
            query: String(input.query ?? ""),
            searchResults: results,
            creditsUsed: searchCredits,
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
          const statusCode = typeof meta?.statusCode === "number" ? meta.statusCode as number : undefined;
          // Extract input metadata
          const formats = Array.isArray(input.formats) ? (input.formats as unknown[]).map((f) => {
            if (typeof f === "string") return f;
            if (typeof f === "object" && f && "type" in f) return String((f as { type: string }).type);
            return String(f);
          }) : undefined;
          const scrapeQuery = Array.isArray(input.formats)
            ? (input.formats as unknown[]).find((f): f is { type: string; prompt: string } =>
                typeof f === "object" && f !== null && (f as { type?: string }).type === "query"
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
            statusCode,
            liveViewUrl: liveViewUrl ? String(liveViewUrl) : undefined,
            interactOutput: interactOutput,
            status,
          });
        } else if (toolName === "bashExec" || toolName === "bash_exec") {
          items.push({
            type: "bash",
            command: String(input.command ?? ""),
            stdout: String((output as { stdout?: string }).stdout ?? ""),
            stderr: String((output as { stderr?: string }).stderr ?? ""),
            exitCode: Number((output as { exitCode?: number }).exitCode ?? 0),
            status,
          });
        } else if (toolName === "load_skill" || toolName === "read_skill_resource") {
          const skillOutput = output as { name?: string; instructions?: string; error?: string };
          // Extract first line of instructions as description
          const desc = skillOutput.instructions
            ? skillOutput.instructions.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim()
            : undefined;
          items.push({
            type: "skill",
            skillName: String(input.name ?? input.skill ?? skillOutput.name ?? ""),
            text: desc,
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
        } else {
          items.push({ type: "other", text: toolName, status });
        }
      }
    }
  }
  // Propagate liveViewUrl from completed interact items to running ones
  const knownLiveViewUrls = new Map<string, string>();
  let lastKnownLiveViewUrl: string | undefined;
  for (const item of items) {
    if (item.type === "interact" && item.liveViewUrl && item.status === "complete") {
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

  return items;
}

// --- Main ---

export default function PlanVisualization({
  messages,
  isRunning,
  preloadedSkills,
}: {
  messages: UIMessage[];
  isRunning: boolean;
  preloadedSkills?: string[];
}) {
  const timeline = extractTimeline(messages);

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
        switch (item.type) {
          case "text":
            return <TextBlock key={i} text={item.text!} isLatest={i === timeline.length - 1} />;
          case "search":
            return (
              <SearchResults
                key={i}
                query={item.query!}
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
                statusCode={item.statusCode}
                isInteract={false}
                isLatest={i === timeline.length - 1}
              />
            ) : (
              (() => {
                const domain = item.url ? getDomain(item.url) : null;
                return (
                  <div key={i} className="my-12 rounded-10 border border-border-faint px-14 py-10 flex items-center gap-8 text-black-alpha-40 animate-pulse">
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
              <BashResult key={i} command={item.command!} stdout={item.stdout!} stderr={item.stderr!} exitCode={item.exitCode!} />
            ) : (() => {
              const bashInfo = describeBashAction(item.command ?? "");
              return bashInfo.isFileOp ? (
                <div key={i} className="my-12 rounded-10 border border-border-faint overflow-hidden">
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
                    <div className="w-10 h-10 rounded-full border-2 border-heat-100 border-t-transparent animate-spin flex-shrink-0" />
                  </div>
                </div>
              ) : (
                <div key={i} className="my-12 rounded-10 border border-border-faint overflow-hidden">
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
                    <div className="w-10 h-10 rounded-full border-2 border-heat-100 border-t-transparent animate-spin flex-shrink-0" />
                  </div>
                </div>
              );
            })();
          case "skill":
            return <SkillLoad key={i} name={item.skillName!} description={item.text} status={item.status} />;
          case "subagent":
            return <SubAgentCard key={i} item={item} />;
          case "format": {
            const fmtLabel: Record<string, string> = { csv: "CSV", json: "JSON", text: "Report" };
            const skillLabel = fmtLabel[item.formatType ?? "text"] ?? "Export";
            return <SkillLoad key={i} name={`${skillLabel} Skill`} description={item.status === "running" ? "Formatting output..." : "Output ready"} status={item.status} />;
          }
          default:
            return null;
        }
      })}

      {/* Running indicator */}
      {isRunning && (
        <div className="flex items-center gap-6 my-12 px-4">
          <div className="w-12 h-12 rounded-full border-2 border-black-alpha-8 border-t-heat-100 animate-spin flex-shrink-0" />
          <span className="text-body-small text-black-alpha-24">Working...</span>
        </div>
      )}

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
