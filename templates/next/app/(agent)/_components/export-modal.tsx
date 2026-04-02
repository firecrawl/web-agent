"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/utils/cn";
import StreamdownBlock from "@/components/shared/streamdown-block";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import Papa from "papaparse";

// --- Helpers ---

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
        <div className="p-14">
          <StreamdownBlock>{content}</StreamdownBlock>
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

// --- Assets Sidebar ---

interface ExportSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  messages: UIMessage[];
  onGenerate?: (format: string) => void;
}

interface BashFile {
  path: string;
  size: number;
  detectedAt: number; // timestamp when first seen
}

interface SkillPackage {
  files: BashFile[];
  name: string;
}

function detectSkillPackage(files: BashFile[]): SkillPackage | null {
  const skillMd = files.find((f) => f.path === "/data/SKILL.md");
  const workflowMjs = files.find((f) => f.path === "/data/workflow.mjs");
  const schemaJson = files.find((f) => f.path === "/data/schema.json");
  if (!skillMd || !workflowMjs) return null;
  const pkgFiles = [skillMd, workflowMjs, ...(schemaJson ? [schemaJson] : [])];
  // Try to extract skill name from SKILL.md filename pattern or default
  return { files: pkgFiles, name: "workflow" };
}

async function downloadZip(files: { path: string }[]) {
  // Fetch all file contents
  const entries = await Promise.all(
    files.map(async (f) => {
      const r = await fetch(`/api/files?path=${encodeURIComponent(f.path)}`);
      const data = await r.json();
      const name = f.path.split("/").pop() ?? "file";
      return { name, content: data.content as string };
    })
  );

  // Build a simple ZIP using raw bytes (no dependency needed)
  // Using Blob-based approach — downloads files individually bundled
  // For a proper zip we'd need a library, so we create a tar-like bundle
  // Actually, let's just trigger individual downloads for now and create a combined JSON manifest
  const manifest = {
    skill_package: true,
    files: entries.map((e) => ({ name: e.name, size: e.content.length })),
    contents: Object.fromEntries(entries.map((e) => [e.name, e.content])),
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "skill-package.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportSidebar({ collapsed, onToggleCollapse, messages, onGenerate }: ExportSidebarProps) {
  const [bashFiles, setBashFiles] = useState<BashFile[]>([]);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string; formatId: string } | null>(null);
  const knownFilesRef = useRef<Map<string, number>>(new Map());

  // Poll for bash files — only show files created during this session
  // Poll for files only when sidebar is open
  useEffect(() => {
    if (collapsed) return;
    const poll = () => {
      fetch("/api/files")
        .then((r) => r.json())
        .then((data) => {
          if (!data.files) return;
          const allFiles = data.files as { path: string; size: number }[];
          const now = Date.now();
          for (const f of allFiles) {
            if (!knownFilesRef.current.has(f.path)) {
              knownFilesRef.current.set(f.path, now);
            }
          }
          const withTimestamps: BashFile[] = allFiles.map((f) => ({
            ...f,
            detectedAt: knownFilesRef.current.get(f.path) ?? now,
          }));
          withTimestamps.sort((a, b) => b.detectedAt - a.detectedAt);
          setBashFiles(withTimestamps);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [collapsed]);

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
          {!collapsed && bashFiles.length > 0 && (
            <span className="text-mono-x-small text-black-alpha-32">{bashFiles.length}</span>
          )}
        </div>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-8 pb-12">
            {/* Skill Package — detected when SKILL.md + workflow.mjs exist */}
            {(() => {
              const pkg = detectSkillPackage(bashFiles);
              if (!pkg) return null;
              const pkgPaths = new Set(pkg.files.map((f) => f.path));
              return (
                <div className="mb-10">
                  <div className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider px-4 pb-6">Skill Package</div>
                  <div className="rounded-8 border border-heat-40 bg-heat-4 p-10">
                    <div className="flex items-center gap-6 mb-8">
                      <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-heat-100 flex-shrink-0">
                        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                      </svg>
                      <span className="text-label-small text-accent-black flex-1">{pkg.name}</span>
                      <span className="text-mono-x-small text-black-alpha-32">{pkg.files.length} files</span>
                    </div>
                    <div className="flex flex-col gap-2 mb-8">
                      {pkg.files.map((f) => {
                        const name = f.path.split("/").pop() ?? f.path;
                        const ext = name.split(".").pop()?.toLowerCase() ?? "";
                        return (
                          <button
                            key={f.path}
                            type="button"
                            className="flex items-center gap-6 px-8 py-4 rounded-6 text-body-small text-black-alpha-56 hover:bg-heat-8 hover:text-accent-black transition-all text-left"
                            onClick={() => viewFile(f.path)}
                          >
                            <span className="text-mono-x-small text-black-alpha-32 w-16 text-center flex-shrink-0">
                              {ext === "md" ? "▪" : ext === "mjs" ? "▸" : ext === "json" ? "{}" : "◻"}
                            </span>
                            <span className="truncate">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-6 px-10 py-6 rounded-6 text-label-small bg-heat-100 text-accent-white hover:bg-heat-90 transition-all"
                      onClick={() => downloadZip(pkg.files)}
                    >
                      <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download Package
                    </button>
                  </div>
                </div>
              );
            })()}

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
                          <div className="text-mono-x-small text-black-alpha-32">{sizeStr} · {new Date(f.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
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
            {onGenerate && (
              <div className="mb-10">
                <div className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider px-4 pb-6">Generate</div>
                <div className="flex flex-col gap-3">
                  {[
                    { id: "JSON", icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" /></svg> },
                    { id: "CSV", icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18M9 6v12M15 6v12" /></svg> },
                    { id: "Markdown", icon: <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg> },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="flex items-center gap-6 px-10 py-6 rounded-8 text-body-small text-black-alpha-56 bg-black-alpha-2 hover:bg-black-alpha-4 hover:text-accent-black transition-all whitespace-nowrap"
                      onClick={() => onGenerate(f.id)}
                    >
                      <span className="flex-shrink-0">{f.icon}</span>
                      {f.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {viewingFile && (
        <FullscreenViewer content={viewingFile.content} formatId={viewingFile.formatId} onClose={() => setViewingFile(null)} />
      )}
    </>
  );
}
