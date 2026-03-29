"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/utils/cn";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import Papa from "papaparse";

function fileExt(formatId: string) {
  if (formatId === "json") return "json";
  if (formatId === "csv" || formatId === "spreadsheet") return "csv";
  if (formatId === "html") return "html";
  return "md";
}

const EXPORT_PREAMBLE = "IMPORTANT: Do NOT search, scrape, or use any web tools. Do NOT do any research. ONLY format the data already provided below. Respond with ONLY the formatted output, no narration or explanation.\n\n";

const FORMATS = [
  {
    id: "json",
    label: "JSON",
    prompt: () => `${EXPORT_PREAMBLE}Format the data below as clean, structured JSON. Use camelCase keys, keep it flat where practical, include every data point. Return ONLY valid JSON.`,
    icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" /></svg>,
  },
  {
    id: "csv",
    label: "CSV",
    prompt: () => `${EXPORT_PREAMBLE}Format the data below as a CSV table. One row per entity, consistent columns, human-readable headers. Return ONLY the CSV.`,
    icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18M9 6v12M15 6v12" /></svg>,
  },
  {
    id: "markdown",
    label: "Markdown",
    prompt: () => `${EXPORT_PREAMBLE}Format the data below as clean, structured markdown with headings, tables, and bullet points. Include all data points.`,
    icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>,
  },
  {
    id: "html",
    label: "HTML App",
    prompt: () => `${EXPORT_PREAMBLE}Build a single-file HTML application that visualizes and presents the data below. Use inline CSS and vanilla JavaScript. Make it interactive — sortable tables, filters, charts where appropriate, responsive layout, modern design with a clean sans-serif font. Start with <!DOCTYPE html>. The entire app must be self-contained in one HTML file with no external dependencies.`,
    icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg>,
  },
];

// --- Helpers ---

let jobCounter = 0;

function getOutputMeta(content: string, formatId: string) {
  const isHtml = /^\s*<!doctype\s+html|^\s*<html/i.test(content.trim());
  const isCsv = formatId === "csv" || formatId === "spreadsheet";
  const isJson = formatId === "json";
  const ext = isJson ? "json" : isCsv ? "csv" : isHtml ? "html" : "md";
  const label = isJson ? "JSON" : isCsv ? "CSV" : isHtml ? "HTML" : "Markdown";
  return { ext, label, isHtml, isCsv, isJson };
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function extractConversationContext(messages: UIMessage[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === "text" && part.text.trim()) {
        parts.push(`[${msg.role}]: ${part.text.slice(0, 2000)}`);
      }
      const p = part as Record<string, unknown>;
      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
        const toolName = (p.toolName ?? "") as string;
        if ((p.state === "output-available" || p.state === "result") && p.output) {
          const out = p.output as Record<string, unknown>;
          const content = out.markdown ?? out.content ?? out.answer ?? out.text ?? out.data;
          if (content) {
            const str = typeof content === "string" ? content : JSON.stringify(content);
            parts.push(`[tool:${toolName}]: ${str.slice(0, 3000)}`);
          }
        }
      }
    }
  }
  return parts.join("\n\n").slice(0, 30000);
}

function stripCodeFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  if (match) return match[1];
  if (trimmed.startsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");
    if (firstNewline > 0 && lastFence > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFence).trim();
    }
  }
  return content;
}

// --- Viewers ---

const jsonStyle: typeof defaultStyles = {
  ...defaultStyles,
  container: "json-view-lite font-mono text-[13px] leading-relaxed",
  basicChildStyle: "pl-16",
  label: "text-black-alpha-56 font-medium",
  nullValue: "text-black-alpha-24 italic",
  undefinedValue: "text-black-alpha-24 italic",
  stringValue: "text-accent-black",
  booleanValue: "text-black-alpha-48 font-medium",
  numberValue: "text-black-alpha-48",
  otherValue: "text-accent-black",
  punctuation: "text-black-alpha-16",
  collapseIcon: "text-black-alpha-24 cursor-pointer select-none hover:text-accent-black",
  expandIcon: "text-black-alpha-24 cursor-pointer select-none hover:text-accent-black",
  collapsedContent: "text-black-alpha-24 cursor-pointer hover:text-accent-black",
  noQuotesForStringValues: false,
};

function JsonViewer({ data }: { data: string }) {
  const parsed = useMemo(() => { try { return JSON.parse(data); } catch { return null; } }, [data]);
  if (!parsed) return <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all p-14">{data}</pre>;

  return (
    <div className="p-14 overflow-auto">
      <JsonView data={parsed} style={jsonStyle} shouldExpandNode={(level) => level < 2} />
    </div>
  );
}

function CsvTable({ data }: { data: string }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");

  const { headers, rows } = useMemo(() => {
    const result = Papa.parse<string[]>(data.trim(), { header: false, skipEmptyLines: true });
    const allRows = result.data;
    if (allRows.length < 2) return { headers: [] as string[], rows: [] as string[][] };
    return { headers: allRows[0], rows: allRows.slice(1) };
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortCol, sortAsc]);

  const handleSort = (col: number) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  if (headers.length === 0) return <pre className="text-mono-small text-accent-black whitespace-pre-wrap break-all p-14">{data}</pre>;

  return (
    <div className="flex flex-col">
      {rows.length > 5 && (
        <div className="px-12 py-8 border-b border-border-faint flex items-center gap-8">
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className="text-black-alpha-24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            className="flex-1 text-body-small bg-transparent text-accent-black placeholder:text-black-alpha-24 focus:outline-none"
            placeholder={`Filter ${rows.length} rows...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-mono-x-small text-black-alpha-24">{sorted.length}/{rows.length}</span>
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full text-body-small border-collapse">
          <thead>
            <tr className="bg-black-alpha-2 border-b border-border-faint sticky top-0 z-10">
              <th className="text-left text-mono-x-small text-black-alpha-24 px-8 py-6 w-1 whitespace-nowrap">#</th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left text-label-small text-black-alpha-56 px-12 py-8 whitespace-nowrap border-l border-border-faint cursor-pointer hover:bg-black-alpha-4 select-none transition-colors"
                  onClick={() => handleSort(i)}
                >
                  <span className="flex items-center gap-4">
                    {h}
                    {sortCol === i && (
                      <svg fill="none" height="10" viewBox="0 0 24 24" width="10" className="text-black-alpha-32" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d={sortAsc ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr key={ri} className={cn("border-b border-border-faint last:border-0 hover:bg-black-alpha-2 transition-colors", ri % 2 === 1 && "bg-black-alpha-1")}>
                <td className="text-mono-x-small text-black-alpha-16 px-8 py-6 w-1 whitespace-nowrap">{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-12 py-6 text-accent-black border-l border-border-faint max-w-[300px] truncate" title={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HtmlViewer({ html, fullHeight }: { html: string; fullHeight?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(fullHeight ? 600 : 300);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    const onLoad = () => {
      if (fullHeight) return;
      try { const doc = iframe.contentDocument; if (doc?.body) setHeight(Math.min(Math.max(doc.body.scrollHeight + 16, 150), 600)); } catch { /* */ }
    };
    iframe.addEventListener("load", onLoad);
    return () => { iframe.removeEventListener("load", onLoad); URL.revokeObjectURL(url); };
  }, [html, fullHeight]);
  return (
    <div className={cn("bg-white", fullHeight ? "h-full" : "")} style={{ height: fullHeight ? "100%" : undefined }}>
      <iframe ref={iframeRef} className="w-full border-0" style={{ height: fullHeight ? "100%" : height }} sandbox="allow-same-origin allow-scripts" title="HTML output" />
    </div>
  );
}

function OutputContent({ content, formatId, maxH }: { content: string; formatId: string; maxH?: string }) {
  const { isHtml, isCsv, isJson } = getOutputMeta(content, formatId);
  const cleaned = useMemo(() => (isJson || isCsv || isHtml) ? stripCodeFences(content) : content, [content, isJson, isCsv, isHtml]);
  return (
    <div className={cn("overflow-auto no-scrollbar", maxH)}>
      {isJson && <JsonViewer data={cleaned} />}
      {isCsv && <CsvTable data={cleaned} />}
      {isHtml && <HtmlViewer html={cleaned} />}
      {!isJson && !isCsv && !isHtml && (
        <div className="p-14 text-body-medium text-accent-black leading-relaxed max-w-none">
          <Streamdown
            plugins={{ code, mermaid }}
            controls={{ table: true, code: true, mermaid: { download: true, copy: true, fullscreen: true } }}
          >
            {content}
          </Streamdown>
        </div>
      )}
    </div>
  );
}

// --- Fullscreen Viewer ---

function FullscreenViewer({ content, formatId, onClose }: { content: string; formatId: string; onClose: () => void }) {
  const { ext, label, isHtml, isCsv } = getOutputMeta(content, formatId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-accent-white">
      <div className="flex items-center justify-between px-20 py-12 border-b border-border-faint bg-background-base flex-shrink-0">
        <div className="flex items-center gap-12">
          <span className="text-mono-x-small text-black-alpha-48 bg-black-alpha-4 px-8 py-2 rounded-4">{label}</span>
          <span className="text-body-small text-black-alpha-32">{(content.length / 1000).toFixed(1)}k chars</span>
        </div>
        <div className="flex items-center gap-8">
          <button type="button" className="flex items-center gap-6 px-12 py-6 rounded-8 text-label-small text-black-alpha-48 hover:bg-black-alpha-4 transition-all" onClick={() => download(stripCodeFences(content), `export.${ext}`)}>
            <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Download .{ext}
          </button>
          <button type="button" className="p-8 rounded-8 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {isHtml ? <HtmlViewer html={content} fullHeight /> : isCsv ? (
          <OutputContent content={content} formatId={formatId} />
        ) : (
          <div className="max-w-[900px] mx-auto"><OutputContent content={content} formatId={formatId} /></div>
        )}
      </div>
    </div>
  );
}

// --- Export Job ---

interface AgentStep {
  type: "tool-call" | "tool-result" | "text";
  name?: string;
  content?: string;
}

interface ExportJob {
  id: string;
  formatId: string;
  label: string;
  status: "running" | "done" | "error";
  content?: string;
  error?: string;
  steps: AgentStep[];
}

function describeToolName(name: string): string {
  if (name === "bashExec" || name === "bash_exec") return "Writing to disk";
  if (name === "formatOutput") return "Formatting output";
  if (name === "search") return "Searching";
  if (name === "scrape") return "Scraping";
  return name;
}

function JobCard({ job, onView, onRemove }: { job: ExportJob; onView: () => void; onRemove: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [removing, setRemoving] = useState(false);
  const formatDef = FORMATS.find((f) => f.id === job.formatId);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(onRemove, 200);
  };

  const { ext } = job.content ? getOutputMeta(job.content, job.formatId) : { ext: fileExt(job.formatId) };
  const isDone = job.status === "done" && !!job.content;

  const latestStep = job.steps.filter((s) => s.type === "tool-call").slice(-1)[0];

  return (
    <div
      className={cn(
        "rounded-8 border overflow-hidden transition-all duration-200",
        mounted && !removing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        isDone ? "border-border-faint hover:border-black-alpha-16" : "border-border-faint",
      )}
    >
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-8 px-10 py-8 text-left transition-colors",
          isDone && "cursor-pointer hover:bg-black-alpha-2",
        )}
        onClick={() => { if (isDone) onView(); }}
        disabled={!isDone}
      >
        {formatDef && <span className="flex-shrink-0 text-black-alpha-40">{formatDef.icon}</span>}
        <div className="flex-1 min-w-0">
          <span className="text-body-small text-accent-black truncate block">{job.label}</span>
          {job.status === "running" && latestStep && (
            <span className="text-mono-x-small text-black-alpha-24 truncate block">
              {describeToolName(latestStep.name ?? "")}
            </span>
          )}
        </div>

        {job.status === "running" && (
          <div className="w-10 h-10 rounded-full border-2 border-heat-100 border-t-transparent animate-spin flex-shrink-0" />
        )}
        {job.status === "error" && (
          <>
            <span className="text-mono-x-small text-accent-crimson">failed</span>
            <span
              role="button"
              tabIndex={0}
              className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleRemove(); } }}
              title="Dismiss"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </span>
          </>
        )}
        {isDone && (
          <span
            role="button"
            tabIndex={0}
            className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
            onClick={(e) => { e.stopPropagation(); download(stripCodeFences(job.content!), `export.${ext}`); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); download(stripCodeFences(job.content!), `export.${ext}`); } }}
            title="Download"
          >
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          </span>
        )}
      </button>

      {/* Agent activity while running */}
      {job.status === "running" && job.steps.length > 0 && (
        <div className="border-t border-border-faint px-10 py-6">
          <div className="flex flex-col gap-2">
            {job.steps.filter((s) => s.type === "tool-call").slice(-3).map((s, i) => (
              <div key={i} className="flex items-center gap-6">
                <div className="w-4 h-4 rounded-full bg-black-alpha-24 animate-pulse flex-shrink-0" />
                <span className="text-mono-x-small text-black-alpha-32 truncate">{describeToolName(s.name ?? "")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- SSE stream reader ---

async function readSSEStream(
  response: Response,
  onStep: (step: AgentStep) => void,
  onDone: (text: string) => void,
  onError: (err: string) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) { onError("No response body"); return; }
  const decoder = new TextDecoder();
  let buffer = "";
  let formatOutputContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "tool-call") {
          onStep({ type: "tool-call", name: data.name });
        } else if (data.type === "tool-result") {
          onStep({ type: "tool-result", name: data.name, content: typeof data.output === "string" ? data.output : JSON.stringify(data.output) });
          if (data.name === "formatOutput" && data.output?.content) {
            formatOutputContent = data.output.content;
          }
          if (data.name === "bashExec" && data.output?.stdout) {
            formatOutputContent = formatOutputContent || data.output.stdout;
          }
        } else if (data.type === "text") {
          onStep({ type: "text", content: data.content });
        } else if (data.type === "done") {
          const text = data.text || formatOutputContent || "";
          onDone(text);
          return;
        } else if (data.type === "error") {
          onError(data.error ?? "Unknown error");
          return;
        }
      } catch { /* skip malformed lines */ }
    }
  }
}

// --- Export Sidebar ---

interface ExportSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  messages: UIMessage[];
}

interface BashFile {
  path: string;
  size: number;
}

export default function ExportSidebar({ collapsed, onToggleCollapse, messages }: ExportSidebarProps) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [fullscreenJob, setFullscreenJob] = useState<ExportJob | null>(null);
  const [bashFiles, setBashFiles] = useState<BashFile[]>([]);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string; formatId: string } | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Poll for bash files
  useEffect(() => {
    const poll = () => {
      fetch("/api/files")
        .then((r) => r.json())
        .then((data) => { if (data.files) setBashFiles(data.files); })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const viewFile = useCallback(async (path: string) => {
    const r = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    const data = await r.json();
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const formatId = ext === "json" ? "json" : ext === "csv" ? "csv" : ext === "html" ? "html" : "report";
    setViewingFile({ path, content: data.content, formatId });
  }, []);

  const downloadFile = useCallback(async (path: string) => {
    const r = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    const data = await r.json();
    const filename = path.split("/").pop() ?? "download";
    download(data.content, filename);
  }, []);

  const runExport = useCallback((formatId: string) => {
    const format = FORMATS.find((f) => f.id === formatId);
    if (!format) return;

    const num = ++jobCounter;
    const jobId = `${formatId}-${num}`;
    const newJob: ExportJob = { id: jobId, formatId, label: format.label, status: "running", steps: [] };
    setJobs((prev) => [newJob, ...prev]);

    const context = extractConversationContext(messagesRef.current);
    const fullPrompt = `${format.prompt()}\n\n---\nDATA:\n${context}`;

    fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: fullPrompt, maxSteps: 1, stream: true }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || `HTTP ${r.status}`);
        }
        await readSSEStream(
          r,
          (step) => {
            setJobs((prev) => prev.map((j) =>
              j.id === jobId ? { ...j, steps: [...j.steps, step] } : j
            ));
          },
          (text) => {
            setJobs((prev) => prev.map((j) =>
              j.id === jobId ? { ...j, status: "done", content: text } : j
            ));
          },
          (err) => {
            setJobs((prev) => prev.map((j) =>
              j.id === jobId ? { ...j, status: "error", error: err } : j
            ));
          },
        );
      })
      .catch((err) => {
        setJobs((prev) => prev.map((j) =>
          j.id === jobId ? { ...j, status: "error", error: err.message } : j
        ));
      });
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const runningCount = jobs.filter((j) => j.status === "running").length;
  const doneCount = jobs.filter((j) => j.status === "done").length;

  return (
    <>
      <div className={cn(
        "h-full border-l border-border-faint bg-background-base flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden",
        collapsed ? "w-48" : "w-320",
      )}>
        {/* Header */}
        <div className={cn("p-12 flex items-center", collapsed ? "justify-center" : "gap-8")}>
          <button
            type="button"
            className="p-6 rounded-6 text-black-alpha-40 hover:bg-black-alpha-4 hover:text-accent-black transition-all flex-shrink-0"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
            </svg>
          </button>
          {!collapsed && (
            <span className="text-label-small text-black-alpha-48 flex-1">Assets</span>
          )}
          {!collapsed && runningCount > 0 && (
            <div className="w-10 h-10 rounded-full border-2 border-heat-100 border-t-transparent animate-spin flex-shrink-0" />
          )}
          {!collapsed && doneCount > 0 && (
            <span className="text-mono-x-small text-accent-forest bg-accent-forest/8 px-6 py-1 rounded-4">
              {doneCount}
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-8 pb-12">
            {/* Files from bash scratchpad */}
            {bashFiles.length > 0 && (
              <div className="mb-10">
                <div className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider px-4 pb-6">Files</div>
                <div className="flex flex-col gap-3">
                  {bashFiles.map((f) => {
                    const name = f.path.split("/").pop() ?? f.path;
                    const ext = name.split(".").pop()?.toLowerCase() ?? "";
                    const sizeStr = f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`;
                    return (
                      <div
                        key={f.path}
                        className="flex items-center gap-6 px-10 py-8 rounded-8 border border-border-faint bg-accent-white hover:border-heat-40 transition-all group"
                      >
                        <span className="text-black-alpha-32 flex-shrink-0 text-mono-x-small">
                          {ext === "json" ? "{}" : ext === "csv" ? "⊞" : ext === "html" ? "◇" : "◻"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-label-small text-accent-black truncate">{name}</div>
                          <div className="text-mono-x-small text-black-alpha-32">{sizeStr}</div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="p-4 rounded-4 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
                            onClick={() => viewFile(f.path)}
                            title="View"
                          >
                            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-4 rounded-4 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
                            onClick={() => downloadFile(f.path)}
                            title="Download"
                          >
                            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Generate section */}
            <div className="mb-10">
              <div className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider px-4 pb-6">Generate</div>
              <div className="grid grid-cols-2 gap-4">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex items-center gap-6 px-10 py-6 rounded-8 text-body-small text-black-alpha-56 bg-black-alpha-2 hover:bg-black-alpha-4 hover:text-accent-black transition-all whitespace-nowrap"
                    onClick={() => runExport(f.id)}
                  >
                    <span className="flex-shrink-0">{f.icon}</span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Job list */}
            {jobs.length > 0 && (
              <div>
                <div className="flex flex-col gap-4">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onView={() => setFullscreenJob(job)}
                      onRemove={() => removeJob(job.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {fullscreenJob?.content && (
        <FullscreenViewer content={fullscreenJob.content} formatId={fullscreenJob.formatId} onClose={() => setFullscreenJob(null)} />
      )}
      {viewingFile && (
        <FullscreenViewer content={viewingFile.content} formatId={viewingFile.formatId} onClose={() => setViewingFile(null)} />
      )}
    </>
  );
}
