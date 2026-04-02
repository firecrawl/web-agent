"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";

interface ConversationEntry {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

function formatRelativeTime(epoch: number): string {
  const diff = Date.now() / 1000 - epoch;
  const minutes = Math.floor(diff / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(epoch * 1000).toLocaleDateString();
}

function PlusIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

const SKILL_FILES = ["SKILL.md", "workflow.mjs", "schema.json"];

function SkillPackageSection() {
  const [files, setFiles] = useState<{ path: string; size: number }[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [viewContent, setViewContent] = useState<string>("");

  useEffect(() => {
    const poll = () => {
      fetch("/api/files")
        .then((r) => r.json())
        .then((data) => {
          if (!data.files) return;
          const pkgFiles = (data.files as { path: string; size: number }[]).filter((f) =>
            SKILL_FILES.some((s) => f.path === `/data/${s}`)
          );
          setFiles(pkgFiles);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const viewFile = useCallback(async (path: string) => {
    if (viewing === path) { setViewing(null); return; }
    const r = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    const data = await r.json();
    setViewContent(data.content);
    setViewing(path);
  }, [viewing]);

  const downloadAll = useCallback(async () => {
    const entries = await Promise.all(
      files.map(async (f) => {
        const r = await fetch(`/api/files?path=${encodeURIComponent(f.path)}`);
        const data = await r.json();
        return { name: f.path.split("/").pop() ?? "file", content: data.content as string };
      })
    );
    const manifest = {
      skill_package: true,
      files: entries.map((e) => e.name),
      contents: Object.fromEntries(entries.map((e) => [e.name, e.content])),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skill-package.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [files]);

  // Need at least SKILL.md + workflow.mjs
  const hasSkillMd = files.some((f) => f.path === "/data/SKILL.md");
  const hasWorkflow = files.some((f) => f.path === "/data/workflow.mjs");
  if (!hasSkillMd || !hasWorkflow) return null;

  return (
    <div className="px-8 pb-12 border-t border-border-faint pt-8">
      <button
        type="button"
        className="w-full flex items-center gap-6 px-4 pb-6"
        onClick={() => setExpanded(!expanded)}
      >
        <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-heat-100 flex-shrink-0">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
        <span className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider flex-1 text-left">Skill Package</span>
        <svg fill="none" height="10" viewBox="0 0 24 24" width="10" className={cn("text-black-alpha-24 transition-transform", expanded && "rotate-180")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2">
          {files.map((f) => {
            const name = f.path.split("/").pop() ?? f.path;
            const ext = name.split(".").pop()?.toLowerCase() ?? "";
            const isViewing = viewing === f.path;
            return (
              <div key={f.path}>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-6 px-10 py-6 rounded-6 text-left transition-all",
                    isViewing ? "bg-heat-4 text-accent-black" : "text-black-alpha-56 hover:bg-black-alpha-2 hover:text-accent-black",
                  )}
                  onClick={() => viewFile(f.path)}
                >
                  <span className="text-mono-x-small text-black-alpha-32 w-14 text-center flex-shrink-0">
                    {ext === "md" ? "▪" : ext === "mjs" ? "▸" : ext === "json" ? "{}" : "◻"}
                  </span>
                  <span className="text-body-small truncate flex-1">{name}</span>
                  <span className="text-mono-x-small text-black-alpha-24 flex-shrink-0">
                    {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}K` : `${f.size}B`}
                  </span>
                </button>
                {isViewing && (
                  <pre className="mx-4 mt-2 mb-4 p-8 rounded-6 bg-black-alpha-2 text-mono-x-small text-black-alpha-56 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
                    {viewContent.slice(0, 2000)}{viewContent.length > 2000 ? "\n..." : ""}
                  </pre>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="flex items-center justify-center gap-6 px-10 py-6 mt-4 rounded-6 text-label-small bg-heat-100 text-accent-white hover:bg-heat-90 transition-all"
            onClick={downloadAll}
          >
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download Package
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  currentId,
  onSelect,
  onNew,
  collapsed = false,
  onToggleCollapse,
}: {
  currentId?: string;
  onSelect: (id: string, title: string) => void;
  onNew: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);

  const refresh = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => setConversations([]));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    refresh();
    if (currentId === id) onNew();
  };

  return (
    <div className={cn(
      "h-full border-r border-border-faint bg-background-base flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden",
      collapsed ? "w-48" : "w-260",
    )}>
      {/* Collapse toggle + New conversation */}
      <div className={cn("p-12 flex items-center", collapsed ? "justify-center" : "gap-8")}>
        {onToggleCollapse && (
          <button
            type="button"
            className="p-6 rounded-6 text-black-alpha-40 hover:bg-black-alpha-4 hover:text-accent-black transition-all flex-shrink-0"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            className="flex-1 flex items-center gap-8 px-12 py-8 rounded-8 text-label-small text-black-alpha-56 hover:bg-black-alpha-4 hover:text-accent-black transition-all border border-border-faint"
            onClick={onNew}
          >
            <PlusIcon />
            New conversation
          </button>
        )}
      </div>

      {/* Conversation list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          {conversations.length === 0 && (
            <div className="px-12 py-20 text-body-small text-black-alpha-24 text-center">
              No conversations yet
            </div>
          )}
          <div className="flex flex-col gap-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={cn(
                  "w-full text-left px-12 py-8 rounded-8 transition-all group flex items-start gap-6",
                  currentId === conv.id
                    ? "bg-heat-4"
                    : "hover:bg-black-alpha-2",
                )}
                onClick={() => onSelect(conv.id, conv.title)}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-body-small truncate",
                    currentId === conv.id ? "text-heat-100" : "text-accent-black",
                  )}>
                    {conv.title}
                  </div>
                  <div className="text-body-small text-black-alpha-24">
                    {formatRelativeTime(conv.updated_at)}
                  </div>
                </div>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-4 text-black-alpha-24 hover:text-accent-crimson hover:bg-black-alpha-4 transition-all flex-shrink-0 mt-2"
                  onClick={(e) => deleteConversation(conv.id, e)}
                >
                  <TrashIcon />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skill Packages — shown when /data/ has SKILL.md + workflow.mjs */}
      {!collapsed && <SkillPackageSection />}
    </div>
  );
}
