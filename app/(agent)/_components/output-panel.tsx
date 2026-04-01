"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import StreamdownBlock from "@/components/shared/streamdown-block";
import { cn } from "@/utils/cn";

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

type Format = "json" | "csv" | "markdown" | "html";

interface FormattedOutput {
  format: "text" | "json" | "csv";
  content: string;
}

function extractFormattedOutput(messages: UIMessage[]): FormattedOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const toolName =
          (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        if (toolName === "formatOutput" && (p.state === "output-available" || p.state === "result") && p.output) {
          const output = p.output as { format: string; content: string };
          if (output.format && output.content) {
            return {
              format: output.format as "text" | "json" | "csv",
              content: output.content,
            };
          }
        }
      }
    }
  }
  return null;
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

function JsonViewer({ data }: { data: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => {
    try { return JSON.parse(data); }
    catch { return null; }
  }, [data]);

  if (!parsed) {
    return <pre className="text-mono-small text-accent-black whitespace-pre-wrap">{data}</pre>;
  }

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const renderValue = (value: unknown, path: string, depth: number): React.ReactNode => {
    if (value === null) return <span className="text-black-alpha-24 italic">null</span>;
    if (typeof value === "boolean") return <span className="text-black-alpha-56">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-black-alpha-56">{value}</span>;
    if (typeof value === "string") {
      const display = value.length > 200 ? value.slice(0, 200) + "..." : value;
      return <span className="text-accent-black">&quot;{display}&quot;</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-black-alpha-32">[]</span>;
      const isCollapsed = collapsed.has(path);
      return (
        <span>
          <button type="button" className="text-black-alpha-32 hover:text-accent-black" onClick={() => toggle(path)}>
            {isCollapsed ? "▸" : "▾"}
          </button>
          {isCollapsed ? <span className="text-black-alpha-32"> [{value.length} items]</span> : (
            <>{"[\n"}{value.map((item, i) => (
              <span key={i}>{"    ".repeat(depth + 1)}{renderValue(item, `${path}[${i}]`, depth + 1)}{i < value.length - 1 ? <span className="text-black-alpha-24">,</span> : ""}{"\n"}</span>
            ))}{"    ".repeat(depth)}<span className="text-black-alpha-32">]</span></>
          )}
        </span>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      if (entries.length === 0) return <span className="text-black-alpha-32">{"{}"}</span>;
      const isCollapsed = collapsed.has(path);
      return (
        <span>
          <button type="button" className="text-black-alpha-32 hover:text-accent-black" onClick={() => toggle(path)}>
            {isCollapsed ? "▸" : "▾"}
          </button>
          {isCollapsed ? <span className="text-black-alpha-32"> {"{"}{entries.length} keys{"}"}</span> : (
            <><span className="text-black-alpha-24">{"{"}</span>{"\n"}{entries.map(([key, val], i) => (
              <span key={key}>{"    ".repeat(depth + 1)}<span className="text-black-alpha-48">&quot;{key}&quot;</span><span className="text-black-alpha-24">: </span>{renderValue(val, `${path}.${key}`, depth + 1)}{i < entries.length - 1 ? <span className="text-black-alpha-24">,</span> : ""}{"\n"}</span>
            ))}{"    ".repeat(depth)}<span className="text-black-alpha-24">{"}"}</span></>
          )}
        </span>
      );
    }

    return <span className="text-accent-black">{String(value)}</span>;
  };

  return (
    <pre className="text-[13px] text-accent-black whitespace-pre-wrap font-mono leading-[1.7]">
      {renderValue(parsed, "$", 0)}
    </pre>
  );
}

function CsvTable({ data }: { data: string }) {
  const rows = useMemo(() => {
    const lines = data.split("\n").filter((l) => l.trim());
    return lines.map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuote = false;
      for (const ch of line) {
        if (ch === '"') inQuote = !inQuote;
        else if (ch === "," && !inQuote) { cells.push(current.trim()); current = ""; }
        else current += ch;
      }
      cells.push(current.trim());
      return cells;
    });
  }, [data]);

  if (rows.length < 2) return <div className="text-body-small text-black-alpha-32">No tabular data</div>;

  return (
    <div className="overflow-auto rounded-10 border border-border-faint">
      <table className="w-full text-body-small">
        <thead>
          <tr className="bg-black-alpha-2 border-b border-border-faint">
            {rows[0].map((h, i) => (
              <th key={i} className="text-left text-label-small text-black-alpha-56 px-12 py-8 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri} className={cn("border-b border-border-faint last:border-0", ri % 2 === 1 && "bg-black-alpha-1")}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-12 py-6 text-accent-black whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FORMAT_OPTIONS: { id: Format; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "json",
    label: "JSON",
    desc: "Structured data",
    icon: (
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "csv",
    label: "CSV",
    desc: "Spreadsheet table",
    icon: (
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M3 6h18M3 12h18M3 18h18M9 6v12M15 6v12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "markdown",
    label: "Report",
    desc: "Markdown summary",
    icon: (
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "html",
    label: "HTML",
    desc: "Styled document",
    icon: (
      <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
];

interface OutputPanelProps {
  messages: UIMessage[];
  onRequestFormat: (format: Format) => void;
}

export default function OutputPanel({ messages, onRequestFormat }: OutputPanelProps) {
  const formatted = extractFormattedOutput(messages);

  if (!formatted) return null;

  const fmt = formatted.format;
  const isJson = fmt === "json";
  const isCsv = fmt === "csv";

  return <FormattedResult formatted={formatted} isJson={isJson} isCsv={isCsv} onRequestFormat={onRequestFormat} />;
}

function HtmlViewer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          setHeight(Math.min(Math.max(doc.body.scrollHeight + 32, 200), 800));
        }
      } catch { /* cross-origin fallback */ }
    };
    iframe.addEventListener("load", onLoad);

    return () => {
      iframe.removeEventListener("load", onLoad);
      URL.revokeObjectURL(url);
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0 rounded-12"
      style={{ height }}
      sandbox="allow-same-origin"
      title="HTML output"
    />
  );
}

function FormattedResult({
  formatted,
  isJson,
  isCsv,
  onRequestFormat,
}: {
  formatted: FormattedOutput;
  isJson: boolean;
  isCsv: boolean;
  onRequestFormat: (format: Format) => void;
}) {
  const isHtml = formatted.format === "text" && /^\s*<!doctype\s+html|^\s*<html/i.test(formatted.content.trim());

  const allTabs = [
    { id: "markdown" as const, label: "Report", show: !isJson && !isCsv },
    { id: "json" as const, label: "JSON", show: isJson },
    { id: "csv" as const, label: "Table", show: isCsv },
  ];
  const visibleTabs = allTabs.filter((t) => t.show);
  const initialTab = visibleTabs[0]?.id ?? "markdown";
  const [activeTab, setActiveTab] = useState<Format>(initialTab);

  const switchFormat = (fmt: Format) => {
    const mapping: Record<Format, FormattedOutput["format"]> = {
      json: "json",
      csv: "csv",
      markdown: "text",
      html: "text",
    };
    if (mapping[fmt] === formatted.format) {
      setActiveTab(fmt);
    } else {
      onRequestFormat(fmt);
    }
  };

  return (
    <div className="border-t border-border-faint mt-20 pt-12">
      <div className="flex items-center justify-between mb-10">
        <div className="flex gap-2 bg-black-alpha-4 rounded-8 p-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "px-10 py-4 rounded-6 text-label-small transition-all",
                activeTab === opt.id
                  ? "bg-accent-white text-accent-black shadow-sm"
                  : "text-black-alpha-56 hover:text-accent-black",
              )}
              onClick={() => switchFormat(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="flex items-center gap-6 text-label-small text-black-alpha-40 hover:text-accent-black transition-colors"
          onClick={() => {
            const ext = formatted.format === "json" ? "json" : formatted.format === "csv" ? "csv" : "md";
            download(formatted.content, `firecrawl-output.${ext}`);
          }}
        >
          <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Download
        </button>
      </div>

      <div className="bg-background-lighter rounded-12 border border-border-faint overflow-hidden">
        {formatted.format === "json" && (
          <div className="p-14 overflow-auto max-h-500">
            <JsonViewer data={formatted.content} />
          </div>
        )}
        {formatted.format === "csv" && (
          <div className="p-14 overflow-auto max-h-500">
            <CsvTable data={formatted.content} />
          </div>
        )}
        {formatted.format === "text" && isHtml && (
          <HtmlViewer html={formatted.content} />
        )}
        {formatted.format === "text" && !isHtml && (
          <div className="p-14 overflow-auto max-h-500">
            <StreamdownBlock>{formatted.content}</StreamdownBlock>
          </div>
        )}
      </div>
    </div>
  );
}
