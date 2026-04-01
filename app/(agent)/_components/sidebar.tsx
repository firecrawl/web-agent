"use client";

import { useState, useEffect } from "react";
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
    </div>
  );
}
