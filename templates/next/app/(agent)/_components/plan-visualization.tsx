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
    <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-8 px-14 py-10 w-full text-left hover:bg-black-alpha-2 transition-colors"
        onClick={() => setUserToggled(collapsed)}
      >
        <EndpointBadge type="search" />
        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black truncate">{query}</div>
          <div className="text-body-small text-black-alpha-40">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        </div>
        <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
          <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", collapsed && "-rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!collapsed && (
        <div className="border-t border-border-faint px-14 py-8 flex flex-col gap-4">
          {results.map((r, i) => (
            <SearchResultItem key={i} result={r} />
          ))}
        </div>
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
        <EndpointBadge type={isInteract ? "interact" : "scrape"} />
        <div className="flex-1 min-w-0">
          <div className="text-label-medium text-accent-black truncate">
            {pageTitle || (domain ?? url)}
          </div>
          <div className="text-body-small text-black-alpha-40 truncate">
            {scrapeQuery ? `"${scrapeQuery}"` : url}
          </div>
        </div>
        {scrapeFormats && scrapeFormats.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {scrapeFormats.map((f) => (
              <span key={f} className={cn(
                "px-6 py-2 rounded-4 text-[10px] font-medium uppercase tracking-wider",
                f === "json" ? "bg-amber-100 text-amber-700" :
                f === "query" ? "bg-blue-100 text-blue-700" :
                f === "markdown" ? "bg-gray-100 text-gray-600" :
                "bg-gray-100 text-gray-500"
              )}>{f}</span>
            ))}
          </div>
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

function InteractCard({ item }: { item: TimelineItem }) {
  const isRunning = item.status !== "complete";
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const contentCollapsed = userCollapsed;
  const domain = item.url ? getDomain(item.url) : null;

  return (
    <>
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
          <EndpointBadge type="interact" />
          <div className="flex-1 min-w-0">
            <div className="text-label-medium text-accent-black truncate">
              {item.pageTitle || (domain ?? item.url)}
            </div>
            <div className="text-body-small text-black-alpha-40 truncate">
              {item.scrapeQuery ? `"${item.scrapeQuery}"` : item.url}
            </div>
          </div>
          {item.scrapeFormats && item.scrapeFormats.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.scrapeFormats.map((f) => (
                <span key={f} className={cn(
                  "px-6 py-2 rounded-4 text-[10px] font-medium uppercase tracking-wider",
                  f === "json" ? "bg-amber-100 text-amber-700" :
                  f === "query" ? "bg-blue-100 text-blue-700" :
                  f === "markdown" ? "bg-gray-100 text-gray-600" :
                  "bg-gray-100 text-gray-500"
                )}>{f}</span>
              ))}
            </div>
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

  return (
      <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="text-label-medium text-accent-black">{label}</div>
            {detail && <div className="text-body-small text-black-alpha-40 truncate">{detail}</div>}
          </div>
          {exitCode === 0 ? (
            <svg className="w-14 h-14 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
              <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="text-mono-x-small text-accent-crimson flex-shrink-0">exit {exitCode}</span>
          )}
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24 flex-shrink-0", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
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
  stepLog?: { tool: string; detail: string; input: Record<string, unknown> }[];
}

/** Extract the first URL from a string (prompt text, detail, JSON, etc.) */
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"',)}\]]+/);
  return m ? m[0] : null;
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
      return { label: url ? new URL(url).hostname : step.detail, url, icon: "scrape" };
    case "interact":
      return { label: url ? `Interacting with ${new URL(url).hostname}` : "Interacting", url, icon: "interact" };
    case "bashExec":
    case "bash_exec":
      return { label: step.detail || "Running command", url: null, icon: "bash" };
    case "load_skill":
    case "lookup_site_playbook":
      return { label: step.detail || step.tool, url: null, icon: "skill" };
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
  const promptUrl = extractUrl(prompt);
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
    subtitleText = promptDomain ? promptUrl! : prompt.slice(0, 80);
  }

  // Show interact indicator when actively interacting
  const isInteracting = workerStatus === "running" && currentStep?.icon === "interact";

  return (
    <div className={cn(
      "rounded-10 border overflow-hidden transition-all",
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
        {workerStatus === "running" && !isInteracting && (
          <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
        )}
        {isInteracting && (
          <svg className="w-14 h-14 text-accent-iris animate-pulse flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 2l1.5 3.5L12 7l-3.5 1.5L7 12l-1.5-3.5L2 7l3.5-1.5z" />
          </svg>
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
                            {tc.name === "scrape" && tcDomain ? tcDomain : tc.name === "interact" && tcDomain ? `interact ${tcDomain}` : tc.name === "search" ? (() => { try { return JSON.parse(tc.input).query || tc.input; } catch { return tc.input; } })() : `${tc.name}: ${tc.input}`}
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

function WorkersPanel({ item }: { item: TimelineItem }) {
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
      fetch("/api/workers/progress")
        .then((r) => r.json())
        .then(setLiveProgress)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
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
          {tasks.map((task) => {
            const r = resultMap.get(task.id);
            const live = liveProgress[task.id];
            return (
              <WorkerCard
                key={task.id}
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
    <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
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

interface TimelineItem {
  type: "text" | "search" | "scrape" | "interact" | "bash" | "skill" | "subagent" | "format" | "workers" | "other";
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
  onArtifactClick,
}: {
  messages: UIMessage[];
  isRunning: boolean;
  preloadedSkills?: string[];
  onArtifactClick?: () => void;
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
            return <TextBlock key={i} text={item.text!} />;
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
                    <div className="w-5 h-5 rounded-full bg-heat-100 animate-pulse flex-shrink-0" />
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
            const fmtLabel: Record<string, string> = { csv: "CSV", json: "JSON", text: "Markdown" };
            const label = fmtLabel[item.formatType ?? "text"] ?? "Output";
            return (
              <div key={i} className="flex items-center gap-6 my-8">
                <span className="text-mono-x-small text-black-alpha-32 bg-black-alpha-4 px-8 py-2 rounded-4">{label}</span>
                {item.status === "running" && (
                  <span className="inline-block w-4 h-4 rounded-full bg-heat-100 animate-pulse" />
                )}
              </div>
            );
          }
          case "workers":
            return <WorkersPanel key={i} item={item} />;
          default:
            return null;
        }
      })}

      {/* Running indicator — show what's happening */}
      {isRunning && (() => {
        const last = timeline.length > 0 ? timeline[timeline.length - 1] : null;
        const lastRunning = last?.status === "running" ? last : null;

        // Workers panel handles its own running state — skip here
        if (lastRunning?.type === "workers") return null;

        // Regular tool running — show as a card tile
        let title = "Thinking";
        let subtitle = "";
        if (lastRunning?.type === "search") { title = "Searching"; subtitle = lastRunning.text?.slice(0, 80) ?? ""; }
        else if (lastRunning?.type === "scrape") { title = "Scraping"; subtitle = lastRunning.url ? new URL(lastRunning.url).hostname : ""; }
        else if (lastRunning?.type === "interact") { title = "Interacting"; subtitle = lastRunning.url ? new URL(lastRunning.url).hostname : ""; }
        else if (lastRunning?.type === "bash") { const b = describeBashAction(lastRunning.command ?? ""); title = b.label; subtitle = b.detail ?? ""; }
        else if (lastRunning?.type === "skill") { title = "Loading skill"; subtitle = lastRunning.skillName ?? ""; }
        else if (lastRunning?.type === "subagent") { title = "Running sub-agent"; subtitle = lastRunning.skillName ?? ""; }

        return (
          <div className="my-12 rounded-10 border border-border-faint overflow-hidden animate-pulse">
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
