"use client";

import { useState, useMemo } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/utils/cn";

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

interface OutputData {
  format: "text" | "json" | "csv";
  content: string;
  hasExplicitFormat: boolean;
}

function extractOutput(messages: UIMessage[]): OutputData | null {
  // 1. Check for explicit formatOutput tool result
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const toolName =
          (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        if (toolName === "formatOutput" && p.state === "result" && p.output) {
          const output = p.output as { format: string; content: string };
          if (output.format && output.content) {
            return {
              format: output.format as "text" | "json" | "csv",
              content: output.content,
              hasExplicitFormat: true,
            };
          }
        }
      }
    }
  }

  // 2. Check for scrape/search tool results with answer fields
  const toolAnswers: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const state = p.state as string;
        if (state === "result" && p.output) {
          const out = p.output as Record<string, unknown>;
          if (out.answer && typeof out.answer === "string") {
            toolAnswers.push(out.answer);
          }
        }
      }
    }
  }
  if (toolAnswers.length > 0) {
    return { format: "text", content: toolAnswers.join("\n\n---\n\n"), hasExplicitFormat: false };
  }

  // 3. Fallback: only use the LAST assistant text (not narration)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const textParts = msg.parts.filter(
      (p) => p.type === "text" && p.text.trim(),
    );
    // Only show if the last text is substantial (not just "I'll do X")
    const lastText = textParts[textParts.length - 1];
    if (lastText && lastText.type === "text" && lastText.text.length > 100) {
      return { format: "text", content: lastText.text, hasExplicitFormat: false };
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
    if (value === null) return <span className="text-black-alpha-40">null</span>;
    if (typeof value === "boolean") return <span className="text-accent-bluetron">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-accent-amethyst">{value}</span>;
    if (typeof value === "string") {
      const display = value.length > 120 ? value.slice(0, 120) + "..." : value;
      return <span className="text-accent-forest">&quot;{display}&quot;</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span>[]</span>;
      const isCollapsed = collapsed.has(path);
      return (
        <span>
          <button type="button" className="text-black-alpha-40 hover:text-accent-black" onClick={() => toggle(path)}>
            {isCollapsed ? "▸" : "▾"}
          </button>
          {isCollapsed ? <span className="text-black-alpha-40"> [{value.length} items]</span> : (
            <>{"[\n"}{value.map((item, i) => (
              <span key={i}>{"  ".repeat(depth + 1)}{renderValue(item, `${path}[${i}]`, depth + 1)}{i < value.length - 1 ? "," : ""}{"\n"}</span>
            ))}{"  ".repeat(depth)}]</>
          )}
        </span>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span>{"{}"}</span>;
      const isCollapsed = collapsed.has(path);
      return (
        <span>
          <button type="button" className="text-black-alpha-40 hover:text-accent-black" onClick={() => toggle(path)}>
            {isCollapsed ? "▸" : "▾"}
          </button>
          {isCollapsed ? <span className="text-black-alpha-40"> {"{"}{entries.length} keys{"}"}</span> : (
            <>{"{\n"}{entries.map(([key, val], i) => (
              <span key={key}>{"  ".repeat(depth + 1)}<span className="text-heat-100">&quot;{key}&quot;</span>{": "}{renderValue(val, `${path}.${key}`, depth + 1)}{i < entries.length - 1 ? "," : ""}{"\n"}</span>
            ))}{"  ".repeat(depth)}{"}"}</>
          )}
        </span>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <pre className="text-mono-small text-accent-black whitespace-pre font-mono leading-relaxed">
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

export default function OutputPanel({ messages }: { messages: UIMessage[] }) {
  const output = extractOutput(messages);

  if (!output) return null;

  // Only show tabs relevant to the data
  const fmt = output.format;
  const isJson = fmt === "json";
  const isCsv = fmt === "csv";
  const [activeTab, setActiveTab] = useState<"text" | "json" | "csv">(fmt);

  const tabs = [
    { id: "text" as const, label: "Text", show: true },
    { id: "json" as const, label: "JSON", show: isJson || output.hasExplicitFormat },
    { id: "csv" as const, label: "Table", show: isCsv },
  ].filter((t) => t.show);

  return (
    <div className="border-t border-border-faint mt-20 pt-12">
      <div className="flex items-center justify-between mb-10">
        {tabs.length > 1 ? (
          <div className="flex gap-2 bg-black-alpha-4 rounded-8 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "px-10 py-4 rounded-6 text-label-small transition-all",
                  activeTab === tab.id
                    ? "bg-accent-white text-accent-black shadow-sm"
                    : "text-black-alpha-56 hover:text-accent-black",
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-label-small text-black-alpha-40">Result</div>
        )}

        <button
          type="button"
          className="flex items-center gap-6 text-label-small text-black-alpha-40 hover:text-accent-black transition-colors"
          onClick={() => {
            const ext = activeTab === "json" ? "json" : activeTab === "csv" ? "csv" : "md";
            download(output.content, `firecrawl-output.${ext}`);
          }}
        >
          <svg fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Download
        </button>
      </div>

      <div className="bg-background-lighter rounded-12 border border-border-faint p-14 overflow-auto max-h-500">
        {activeTab === "json" && <JsonViewer data={output.content} />}
        {activeTab === "csv" && <CsvTable data={output.content} />}
        {activeTab === "text" && (
          <div className="text-body-medium text-accent-black whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
            {output.content}
          </div>
        )}
      </div>
    </div>
  );
}
