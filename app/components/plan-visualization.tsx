"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { createCodePlugin } from "@streamdown/code";

const code = createCodePlugin({ themes: ["github-light", "github-light"] });
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
        <div className="border-t border-border-faint bg-background-lighter p-12 max-h-400 overflow-auto">
          <div className="text-body-small text-black-alpha-56 leading-relaxed prose prose-sm max-w-none prose-headings:text-black-alpha-56 prose-a:text-heat-100">
            <Streamdown plugins={{ code }}>{result.markdown!}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, results, creditsUsed }: { query: string; results: SearchResult[]; creditsUsed?: number }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="my-12">
      <button
        type="button"
        className="flex items-center gap-8 mb-8 text-black-alpha-40 w-full text-left hover:text-black-alpha-56 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <SearchIcon />
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
      {!collapsed && (
        <div className="flex flex-col gap-4 ml-26">
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLiveView, setShowLiveView] = useState(false);
  const domain = getDomain(url);
  const hasContent = !!(content || answer || interactOutput);

  return (
    <div className={cn("my-12 rounded-10 border overflow-hidden transition-all", expanded ? "border-heat-40 shadow-sm" : "border-border-faint hover:border-black-alpha-16")}>
      {/* Header - clickable */}
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            {isInteract && (
              <span className="text-mono-x-small text-accent-bluetron bg-accent-bluetron/8 px-6 py-1 rounded-4 flex-shrink-0">interact</span>
            )}
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

      {/* Interact output -- always visible */}
      {interactOutput && (
        <div className="mx-14 mb-10 bg-accent-bluetron/[0.04] rounded-8 border border-accent-bluetron/15 p-12">
          <div className="text-body-medium text-accent-black leading-relaxed prose prose-sm max-w-none">
            <Streamdown plugins={{ code }}>{interactOutput}</Streamdown>
          </div>
        </div>
      )}

      {/* Answer (direct query result) -- always visible */}
      {answer && (
        <div className="mx-14 mb-10 bg-heat-4 rounded-8 border border-heat-20 p-12">
          <div className="text-body-medium text-accent-black leading-relaxed prose prose-sm max-w-none">
            <Streamdown plugins={{ code }}>{answer}</Streamdown>
          </div>
        </div>
      )}

      {/* Live view button + iframe */}
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
              <iframe
                src={liveViewUrl}
                className="w-full border-0"
                style={{ height: 500 }}
                title="Live browser view"
              />
            </div>
          )}
        </div>
      )}

      {/* Expanded: full content */}
      {expanded && content && (
        <div className="border-t border-border-faint bg-background-lighter p-14 max-h-500 overflow-auto">
          {isJsonContent(content) ? (
            <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{extractJsonContent(content)}</pre>
          ) : (
            <div className="text-body-small text-black-alpha-56 leading-relaxed prose prose-sm max-w-none prose-headings:text-black-alpha-56 prose-a:text-heat-100">
              <Streamdown plugins={{ code }}>{content}</Streamdown>
            </div>
          )}
        </div>
      )}

      {/* Collapsed: show snippet + click hint */}
      {!expanded && content && !answer && !interactOutput && (
        <div className="px-14 pb-10">
          <div className="text-body-small text-black-alpha-32 line-clamp-2">
            {extractJsonContent(content).slice(0, 200).replace(/[#*_`>\[\]]/g, "")}
          </div>
          <div className="text-label-x-small text-heat-100 mt-4">Click to expand scraped content</div>
        </div>
      )}
      {!hasContent && (
        <div className="px-14 pb-10">
          <div className="text-body-small text-black-alpha-24 italic">No content returned</div>
        </div>
      )}
    </div>
  );
}

// --- Interact card (shows iframe while running) ---

function InteractCard({ item }: { item: TimelineItem }) {
  const isRunning = item.status !== "complete";
  // Show live view only while running, hide once complete
  const [userToggled, setUserToggled] = useState(false);
  const showLiveView = userToggled ? !isRunning ? false : true : isRunning;
  const domain = item.url ? getDomain(item.url) : null;

  return (
    <div className={cn(
      "my-12 rounded-10 border overflow-hidden transition-all",
      isRunning ? "border-heat-40 shadow-sm" : "border-border-faint",
    )}>
      {/* Header */}
      <div className="flex items-center gap-8 px-14 py-10">
        {domain ? <Favicon domain={domain} /> : <GlobeIcon />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-6">
            <span className="text-mono-x-small text-heat-100 bg-heat-4 px-6 py-1 rounded-4 flex-shrink-0">
              interact
            </span>
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
            >
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Interact output */}
      {item.interactOutput && (
        <div className="mx-14 mb-10 bg-black-alpha-2 rounded-8 border border-border-faint p-12">
          <div className="text-body-medium text-accent-black leading-relaxed prose prose-sm max-w-none">
            <Streamdown plugins={{ code }}>{item.interactOutput}</Streamdown>
          </div>
        </div>
      )}

      {/* Live view iframe -- auto-shown while running, hidden once complete */}
      {item.liveViewUrl && (
        <div className="mx-14 mb-10">
          {!isRunning && (
            <button
              type="button"
              className="inline-flex items-center gap-6 px-10 py-5 rounded-6 text-label-small text-black-alpha-48 bg-black-alpha-4 hover:bg-black-alpha-8 transition-all mb-8"
              onClick={() => setUserToggled(!userToggled)}
            >
              <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {userToggled ? "Hide live view" : "Show live view"}
            </button>
          )}
          {(showLiveView || userToggled) && (
            <div className="rounded-8 border border-border-faint overflow-hidden bg-white" style={{ aspectRatio: "16/10" }}>
              <iframe
                src={item.liveViewUrl}
                className="w-full h-full border-0"
                title="Live browser view"
              />
            </div>
          )}
        </div>
      )}

      {/* Content (for completed interact that also returned markdown) */}
      {item.content && item.status === "complete" && (
        <div className="border-t border-border-faint bg-background-lighter p-14 max-h-300 overflow-auto">
          {isJsonContent(item.content) ? (
            <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{extractJsonContent(item.content)}</pre>
          ) : (
            <div className="text-body-small text-black-alpha-56 leading-relaxed prose prose-sm max-w-none">
              <Streamdown plugins={{ code }}>{item.content}</Streamdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Bash result rendering ---

function BashResult({ command, stdout, stderr, exitCode }: { command: string; stdout: string; stderr: string; exitCode: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = !!(stdout || stderr);
  const outputLines = (stdout || "").split("\n").length + (stderr || "").split("\n").length;

  return (
    <div className={cn("my-12 rounded-10 border overflow-hidden transition-all", expanded ? "border-black-alpha-16 shadow-sm" : "border-border-faint hover:border-black-alpha-16")}>
      <button
        type="button"
        className="w-full flex items-center gap-8 px-14 py-10 hover:bg-black-alpha-2 transition-colors text-left cursor-pointer"
        onClick={() => hasOutput && setExpanded(!expanded)}
      >
        <TerminalIcon />
        <code className="flex-1 text-mono-small text-accent-black truncate">{command}</code>
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
          {hasOutput && (
            <span className="text-mono-x-small text-black-alpha-24 bg-black-alpha-4 px-6 py-1 rounded-4">
              {outputLines} line{outputLines !== 1 ? "s" : ""}
            </span>
          )}
          {hasOutput && (
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform text-black-alpha-24", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>
      </button>

      {/* Collapsed preview */}
      {!expanded && stdout && (
        <div className="px-14 pb-10">
          <div className="text-mono-x-small text-black-alpha-32 line-clamp-2 whitespace-pre-wrap">{stdout.slice(0, 200)}</div>
        </div>
      )}

      {/* Expanded output */}
      {expanded && hasOutput && (
        <div className="border-t border-border-faint bg-black-alpha-2 p-14 max-h-300 overflow-auto">
          {stdout && <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{stdout}</pre>}
          {stderr && <pre className="text-mono-small text-accent-crimson whitespace-pre-wrap mt-8">{stderr}</pre>}
        </div>
      )}
    </div>
  );
}

// --- Skill load rendering ---

function SkillLoad({ name, description, status }: { name: string; description?: string; status: "running" | "complete" }) {
  return (
    <div className="my-12 rounded-10 border border-accent-forest/15 bg-accent-forest/[0.03] overflow-hidden">
      <div className="flex items-center gap-10 px-14 py-10">
        <div className="w-28 h-28 rounded-8 bg-accent-forest/10 flex-center flex-shrink-0">
          <SkillIcon />
        </div>
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
        <span className="text-mono-x-small text-accent-forest/60 bg-accent-forest/8 px-8 py-2 rounded-4 flex-shrink-0">
          skill
        </span>
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
  // status
  status: "running" | "complete";
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
          // Parse search results from output
          // Firecrawl returns { success, data: [...] } but the AI SDK may wrap it
          const results: SearchResult[] = [];
          if (output && typeof output === "object") {
            // Try output.data (standard Firecrawl response)
            let data = (output as Record<string, unknown>).data;
            // Try output.results
            if (!Array.isArray(data)) data = (output as Record<string, unknown>).results;
            // Try output itself if it's an array
            if (!Array.isArray(data) && Array.isArray(output)) data = output;
            // Try output[0].data if wrapped in array
            if (!Array.isArray(data) && Array.isArray((output as Record<string, unknown>)[0])) {
              data = (output as Record<string, unknown>)[0];
            }
            if (Array.isArray(data)) {
              for (const r of data as Record<string, unknown>[]) {
                if (r && typeof r === "object" && (r.url || r.title)) {
                  results.push({
                    title: String(r.title ?? ""),
                    url: String(r.url ?? ""),
                    description: String(r.description ?? r.snippet ?? ""),
                    markdown: typeof r.markdown === "string" ? r.markdown : undefined,
                  });
                }
              }
            }
          }
          const searchCredits = typeof (output as { creditsUsed?: number }).creditsUsed === "number"
            ? (output as { creditsUsed?: number }).creditsUsed
            : undefined;
          // Debug: log when we have output but no results parsed
          if (status === "complete" && results.length === 0 && output && Object.keys(output).length > 0) {
            console.log("[search debug] output keys:", Object.keys(output), "output sample:", JSON.stringify(output).slice(0, 300));
          }
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
          // Fallback: if nothing found, dump the raw output (excluding huge fields)
          if (!markdown && typeof outObj === "object" && outObj && status === "complete") {
            const preview = { ...outObj };
            delete (preview as Record<string, unknown>).rawHtml;
            delete (preview as Record<string, unknown>).html;
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
          const result = (output as { result?: string; subAgent?: string; steps?: number }).result;
          const agentName = (output as { subAgent?: string }).subAgent ?? toolName.replace("subagent_", "");
          const steps = (output as { steps?: number }).steps;
          items.push({
            type: "subagent",
            text: result ? String(result) : String(input.task ?? ""),
            skillName: agentName,
            exitCode: steps ?? 0,
            status,
          });
        } else if (toolName === "formatOutput") {
          // Skip — handled by OutputPanel
          items.push({ type: "format", status });
        } else {
          items.push({ type: "other", text: toolName, status });
        }
      }
    }
  }
  // Propagate liveViewUrl from completed interact items to running ones
  const knownLiveViewUrls = new Map<string, string>();
  for (const item of items) {
    if (item.type === "interact" && item.liveViewUrl && item.status === "complete") {
      const domain = item.url ? getDomain(item.url) : null;
      if (domain) knownLiveViewUrls.set(domain, item.liveViewUrl);
    }
  }
  for (const item of items) {
    if (item.type === "interact" && !item.liveViewUrl) {
      const domain = item.url ? getDomain(item.url) : null;
      if (domain && knownLiveViewUrls.has(domain)) {
        item.liveViewUrl = knownLiveViewUrls.get(domain);
      }
    }
  }

  return items;
}

// --- Main ---

export default function PlanVisualization({
  messages,
  isRunning,
}: {
  messages: UIMessage[];
  isRunning: boolean;
}) {
  const timeline = extractTimeline(messages);

  if (timeline.length === 0 && !isRunning) {
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
      {timeline.map((item, i) => {
        switch (item.type) {
          case "text":
            return (
              <div key={i} className="text-body-large text-accent-black leading-relaxed my-12 prose prose-sm max-w-none prose-headings:text-accent-black prose-a:text-heat-100 prose-strong:text-accent-black prose-code:text-heat-100 prose-code:bg-heat-4 prose-code:px-4 prose-code:py-1 prose-code:rounded-4">
                <Streamdown plugins={{ code }}>{item.text!}</Streamdown>
              </div>
            );
          case "search":
            return (
              <SearchResults
                key={i}
                query={item.query!}
                results={item.status === "complete" && item.searchResults?.length ? item.searchResults : []}
                creditsUsed={item.creditsUsed}
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
              />
            ) : (
              (() => {
                const domain = item.url ? getDomain(item.url) : null;
                return (
                  <div key={i} className="my-8 rounded-10 border border-border-faint px-14 py-10 flex items-center gap-8 text-black-alpha-40 animate-pulse">
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
            ) : (
              <div key={i} className="flex items-center gap-8 my-8 py-4 text-black-alpha-40">
                <TerminalIcon />
                <code className="text-mono-small">{item.command}</code>
                <div className="w-4 h-4 rounded-full bg-heat-100 animate-pulse" />
              </div>
            );
          case "skill":
            return <SkillLoad key={i} name={item.skillName!} description={item.text} status={item.status} />;
          case "subagent":
            return (
              <div key={i} className="my-12 rounded-12 border border-accent-amethyst/15 bg-accent-amethyst/[0.03] overflow-hidden">
                {/* Sub-agent header */}
                <div className="flex items-center gap-8 px-14 py-10 border-b border-accent-amethyst/10">
                  <div className="w-24 h-24 rounded-6 bg-accent-amethyst/10 flex-center flex-shrink-0">
                    <svg fill="none" height="14" viewBox="0 0 24 24" width="14" className="text-accent-amethyst">
                      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-label-small text-accent-amethyst font-medium">
                      {item.skillName ?? "Sub-agent"}
                    </div>
                    {item.status === "running" && (
                      <div className="text-body-small text-black-alpha-32">Running...</div>
                    )}
                    {item.status === "complete" && item.exitCode !== undefined && item.exitCode > 0 && (
                      <div className="text-body-small text-black-alpha-32">
                        Completed in {item.exitCode} step{item.exitCode !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  {item.status === "running" && (
                    <div className="w-5 h-5 rounded-full bg-accent-amethyst animate-pulse flex-shrink-0" />
                  )}
                  {item.status === "complete" && (
                    <svg className="w-16 h-16 text-accent-forest flex-shrink-0" fill="none" viewBox="0 0 16 16">
                      <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {/* Sub-agent result */}
                {item.status === "complete" && item.text && (
                  <div className="px-14 py-10">
                    <div className="text-body-medium text-black-alpha-56 whitespace-pre-wrap line-clamp-6">
                      {item.text}
                    </div>
                  </div>
                )}
              </div>
            );
          case "format":
            return null; // Handled by OutputPanel
          default:
            return null;
        }
      })}

      {/* Running indicator */}
      {isRunning && (
        <div className="flex items-center gap-8 my-12 py-4">
          <div className="relative w-18 h-18 flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-black-alpha-8 border-t-heat-100 animate-spin" />
          </div>
          <span className="text-body-medium text-black-alpha-32">Working...</span>
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
