"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/utils/cn";
import StreamdownBlock from "@/components/shared/streamdown-block";
import { codeToHtml } from "shiki/bundle/web";

const shikiLangMap: Record<string, string> = {
  curl: "bash",
  fetch: "javascript",
  python: "python",
};

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const prevKey = useRef("");

  useEffect(() => {
    const key = `${lang}:${code}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    const shikiLang = shikiLangMap[lang] ?? lang;
    codeToHtml(code, {
      lang: shikiLang,
      theme: "github-light",
    })
      .then((result) => {
        if (prevKey.current === key) setHtml(result);
      })
      .catch(() => setHtml(null));
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="px-14 pb-10 text-[12px] font-mono leading-[1.6] text-accent-black whitespace-pre-wrap overflow-auto max-h-[280px]">
        {code}
      </pre>
    );
  }

  return (
    <div
      className="px-14 pb-10 text-[12px] leading-[1.6] overflow-auto max-h-[280px] [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_pre]:whitespace-pre-wrap [&_code]:!font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

interface FormattedOutput {
  format: "text" | "json" | "csv";
  content: string;
}

// Infer a JSON schema from actual data
function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  if (typeof value === "string") return { type: "string" };

  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {} };
    // Merge schemas from all items to get a unified item schema
    const itemSchemas = value.slice(0, 5).map(inferSchema);
    const merged = mergeSchemas(itemSchemas);
    return { type: "array", items: merged };
  }

  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v);
      if (v !== null && v !== undefined) required.push(k);
    }
    const schema: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) schema.required = required;
    return schema;
  }

  return {};
}

function mergeSchemas(schemas: Record<string, unknown>[]): Record<string, unknown> {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];

  // If all are objects, merge their properties
  const allObjects = schemas.every((s) => s.type === "object");
  if (allObjects) {
    const allProps = new Map<string, Record<string, unknown>[]>();
    const allKeys = new Set<string>();
    for (const s of schemas) {
      const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
      for (const [k, v] of Object.entries(props)) {
        allKeys.add(k);
        if (!allProps.has(k)) allProps.set(k, []);
        allProps.get(k)!.push(v);
      }
    }
    const mergedProps: Record<string, unknown> = {};
    for (const k of allKeys) {
      const propSchemas = allProps.get(k)!;
      mergedProps[k] = propSchemas.length === 1 ? propSchemas[0] : mergeSchemas(propSchemas);
    }
    // Required = keys present in ALL items
    const required = [...allKeys].filter((k) => allProps.get(k)!.length === schemas.length);
    const result: Record<string, unknown> = { type: "object", properties: mergedProps };
    if (required.length > 0) result.required = required;
    return result;
  }

  // If types differ, just return the first
  return schemas[0];
}

function extractFormattedOutput(messages: UIMessage[]): FormattedOutput & { streaming: boolean } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const toolName = (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        if (toolName !== "formatOutput") continue;

        const state = (p.state ?? "") as string;
        const isComplete = state === "output-available" || state === "result";

        // Complete: use the final output
        if (isComplete && p.output) {
          const output = p.output as { format: string; content: string };
          if (output.format && output.content) {
            return { format: output.format as FormattedOutput["format"], content: output.content, streaming: false };
          }
        }

        // Still streaming: use the tool input data as a preview
        if (!isComplete) {
          const input = (p.input ?? p.args ?? {}) as Record<string, unknown>;
          const format = (input.format as string) ?? "json";
          let content = "";
          if (input.data !== undefined) {
            content = typeof input.data === "string" ? input.data : JSON.stringify(input.data, null, 2);
          }
          // Show streaming state even before data arrives
          return { format: format as FormattedOutput["format"], content: content || "...", streaming: true };
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

export function JsonViewer({ data }: { data: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => {
    try { return JSON.parse(data); }
    catch { return null; }
  }, [data]);

  if (!parsed) {
    return <pre className="text-mono-small text-accent-black whitespace-pre-wrap p-14">{data}</pre>;
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
    <pre className="text-[13px] text-accent-black whitespace-pre-wrap font-mono leading-[1.7] p-14">
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

  if (rows.length < 2) return <div className="text-body-small text-black-alpha-32 p-14">No tabular data</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full text-body-small border-collapse">
        <thead>
          <tr className="bg-black-alpha-2 border-b border-border-faint sticky top-0">
            {rows[0].map((h, i) => (
              <th key={i} className="text-left text-label-small text-black-alpha-56 px-12 py-8 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri} className={cn("border-b border-border-faint last:border-0", ri % 2 === 1 && "bg-black-alpha-1")}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-12 py-6 text-accent-black whitespace-nowrap max-w-[240px] truncate" title={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Workflow Package Viewer ---

const WORKFLOW_FILES = [
  { path: "/data/SKILL.md", label: "SKILL.md", icon: "▪", desc: "Agent instructions + self-healing" },
  { path: "/data/workflow.mjs", label: "workflow.mjs", icon: "▸", desc: "Deterministic script" },
  { path: "/data/schema.json", label: "schema.json", icon: "{}", desc: "Expected output shape" },
];

function WorkflowPanel({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [active, setActive] = useState("/data/SKILL.md");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries: Record<string, string> = {};
      for (const f of WORKFLOW_FILES) {
        try {
          const r = await fetch(`/api/files?path=${encodeURIComponent(f.path)}`);
          const data = await r.json();
          if (data.content) entries[f.path] = data.content;
        } catch { /* skip missing files */ }
      }
      if (!cancelled) { setFiles(entries); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const downloadAll = useCallback(async () => {
    const manifest = {
      skill_package: true,
      files: Object.keys(files).map((p) => p.split("/").pop()),
      contents: Object.fromEntries(Object.entries(files).map(([p, c]) => [p.split("/").pop()!, c])),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skill-package.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [files]);

  const downloadFile = useCallback((path: string) => {
    const content = files[path];
    if (!content) return;
    const name = path.split("/").pop() ?? "file";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [files]);

  const available = WORKFLOW_FILES.filter((f) => files[f.path]);

  return (
    <div className="h-full border-l border-border-faint bg-background-base flex flex-col flex-shrink-0 w-full md:w-[50%] transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-14 py-10 border-b border-border-faint flex items-center gap-8">
        <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-heat-100 flex-shrink-0">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
        <span className="text-label-medium text-accent-black">Skill Package</span>
        <span className="text-mono-x-small text-black-alpha-32">{available.length} files</span>
        <span className="flex-1" />
        <button
          type="button"
          className="flex items-center gap-4 text-mono-x-small text-accent-white bg-heat-100 hover:bg-heat-90 px-10 py-4 rounded-6 transition-all"
          onClick={downloadAll}
        >
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download All
        </button>
        <button
          type="button"
          className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
          onClick={onClose}
        >
          <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-black-alpha-24 text-body-small">
          Loading files...
        </div>
      ) : (
        <>
          {/* File tabs */}
          <div className="border-b border-border-faint">
            {available.map((f) => (
              <button
                key={f.path}
                type="button"
                className={cn(
                  "flex items-center gap-8 px-14 py-10 text-left transition-all w-full",
                  active === f.path
                    ? "bg-heat-4 border-l-2 border-heat-100"
                    : "hover:bg-black-alpha-2 border-l-2 border-transparent",
                )}
                onClick={() => setActive(f.path)}
              >
                <span className="text-mono-x-small text-black-alpha-40 w-16 text-center flex-shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-label-small", active === f.path ? "text-heat-100" : "text-accent-black")}>{f.label}</div>
                  <div className="text-mono-x-small text-black-alpha-32">{f.desc}</div>
                </div>
                <button
                  type="button"
                  className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); downloadFile(f.path); }}
                  title={`Download ${f.label}`}
                >
                  <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </button>
              </button>
            ))}
          </div>

          {/* File content */}
          <div className="flex-1 overflow-auto no-scrollbar">
            {files[active] && active.endsWith(".json") ? (
              <JsonViewer data={files[active]} />
            ) : (
              <pre className="text-[13px] text-accent-black whitespace-pre-wrap font-mono leading-[1.7] p-14">
                {files[active] ?? "File not found"}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface ArtifactPanelProps {
  messages: UIMessage[];
  isRunning: boolean;
  onRequestFormat: (format: string) => void;
  onClose: () => void;
  prompt?: string;
  schema?: Record<string, unknown>;
  urls?: string[];
}

function buildCodeSnippet(lang: "curl" | "fetch" | "python", prompt: string, schema?: Record<string, unknown>, urls?: string[]): string {
  const body: Record<string, unknown> = { prompt, format: "json" };
  if (schema) body.schema = schema;
  if (urls?.length) body.urls = urls;
  const jsonBody = JSON.stringify(body, null, 2);

  if (lang === "curl") {
    return `curl -X POST http://localhost:3002/api/v1/run \\
  -H "Content-Type: application/json" \\
  -d '${jsonBody}'`;
  }
  if (lang === "fetch") {
    return `const response = await fetch("http://localhost:3002/api/v1/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${jsonBody}),
});
const data = await response.json();
console.log(data);`;
  }
  return `import requests

response = requests.post(
    "http://localhost:3002/api/v1/run",
    json=${jsonBody.replace(/: true/g, ": True").replace(/: false/g, ": False").replace(/: null/g, ": None")},
)
print(response.json())`;
}

export default function ArtifactPanel({ messages, isRunning, onRequestFormat, onClose, prompt, schema, urls }: ArtifactPanelProps) {
  const formatted = extractFormattedOutput(messages);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const [showCode, setShowCode] = useState(false);
  const [codeLang, setCodeLang] = useState<"curl" | "fetch" | "python">("curl");
  const [copied, setCopied] = useState(false);

  // Reset code panel when new output arrives
  const prevContentRef = useRef<string | null>(null);
  useEffect(() => {
    if (formatted && !formatted.streaming && formatted.content !== prevContentRef.current) {
      setShowCode(false);
      prevContentRef.current = formatted.content;
    }
  }, [formatted]);

  // Infer schema from output data when it becomes available
  const inferredSchema = useMemo(() => {
    if (!formatted || formatted.streaming || formatted.format !== "json") return null;
    try {
      const parsed = JSON.parse(formatted.content);
      return inferSchema(parsed);
    } catch { return null; }
  }, [formatted]);

  // The schema to use in code snippets: user-provided takes precedence, then inferred
  const codeSchema = schema ?? inferredSchema ?? undefined;



  if (showWorkflow) return <WorkflowPanel onClose={() => setShowWorkflow(false)} />;

  if (!formatted) return null;

  const fmt = formatted.format;
  const isStreaming = formatted.streaming;

  const isJson = fmt === "json";
  const isCsv = fmt === "csv";
  const ext = isJson ? "json" : isCsv ? "csv" : "md";
  const label = isJson ? "JSON" : isCsv ? "CSV" : "Markdown";
  const sizeStr = formatted.content.length > 1024
    ? `${(formatted.content.length / 1024).toFixed(1)} KB`
    : `${formatted.content.length} B`;

  return (
    <div className="h-full border-l border-border-faint bg-background-base flex flex-col flex-shrink-0 w-full md:w-[50%] transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-14 py-10 border-b border-border-faint flex items-center gap-8">
        {isStreaming ? (
          <span className="text-mono-x-small text-black-alpha-32 flex items-center gap-4">
            <span className="inline-block w-4 h-4 rounded-full bg-heat-100 animate-pulse" />
            Streaming...
          </span>
        ) : (
          <div className="flex items-center gap-4">
            {([
              { id: "JSON", active: isJson },
              { id: "CSV", active: isCsv },
              { id: "Markdown", active: !isJson && !isCsv },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={f.active}
                className={cn(
                  "px-8 py-4 rounded-6 text-mono-x-small transition-all",
                  f.active
                    ? "bg-black-alpha-4 text-accent-black"
                    : "text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4",
                )}
                onClick={() => { if (!f.active) onRequestFormat(f.id); }}
              >
                {f.id}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        {!isStreaming && (
          <>
            <button
              type="button"
              className={cn(
                "flex items-center gap-4 text-mono-x-small transition-colors",
                showCode ? "text-accent-black" : "text-black-alpha-32 hover:text-accent-black",
              )}
              onClick={() => setShowCode(!showCode)}
            >
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              Code
            </button>
            <button
              type="button"
              className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
              onClick={() => download(formatted.content, `output.${ext}`)}
            >
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download
            </button>
            <button
              type="button"
              className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
              onClick={() => setShowWorkflow(true)}
            >
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              Workflow
            </button>
          </>
        )}
        <button
          type="button"
          className="p-4 rounded-4 text-black-alpha-24 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
          onClick={onClose}
        >
          <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Code snippet panel */}
      {showCode && (
        <div className="border-b border-border-faint bg-black-alpha-2">
          <div className="px-14 py-6 flex items-center gap-4">
            {(["curl", "fetch", "python"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                className={cn(
                  "px-8 py-3 rounded-6 text-mono-x-small transition-all",
                  codeLang === lang
                    ? "bg-accent-white text-accent-black shadow-sm"
                    : "text-black-alpha-40 hover:text-accent-black",
                )}
                onClick={() => setCodeLang(lang)}
              >
                {lang === "fetch" ? "JavaScript" : lang === "python" ? "Python" : "cURL"}
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(buildCodeSnippet(codeLang, prompt ?? "", codeSchema, urls));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {inferredSchema && !schema && (
            <div className="px-14 pb-4">
              <span className="text-mono-x-small text-black-alpha-24">Schema inferred from output — rerun with this schema for consistent results</span>
            </div>
          )}
          <HighlightedCode code={buildCodeSnippet(codeLang, prompt ?? "", codeSchema, urls)} lang={codeLang} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isJson && (
          isStreaming
            ? <pre className="text-[13px] text-accent-black whitespace-pre-wrap font-mono leading-[1.7] p-14">{formatted.content}</pre>
            : <JsonViewer data={formatted.content} />
        )}
        {isCsv && <CsvTable data={formatted.content} />}
        {!isJson && !isCsv && (
          <div className="p-14">
            <StreamdownBlock>{formatted.content}</StreamdownBlock>
          </div>
        )}
      </div>


    </div>
  );
}
