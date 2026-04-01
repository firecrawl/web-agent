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

export default function HistoryPanel({
  onSelect,
  currentId,
}: {
  onSelect: (id: string, title: string) => void;
  currentId?: string;
}) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [show, setShow] = useState(false);

  const refresh = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => setConversations([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  if (conversations.length === 0) return null;

  const visible = show ? conversations : conversations.slice(0, 3);

  return (
    <div className="mt-32">
      <div className="flex items-center justify-between mb-16">
        <h2 className="text-label-medium text-accent-black">Recent</h2>
        {conversations.length > 3 && (
          <button
            type="button"
            className="text-body-small text-black-alpha-32 hover:text-heat-100 transition-colors"
            onClick={() => setShow(!show)}
          >
            {show ? "Show less" : `See all (${conversations.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {visible.map((conv) => (
          <button
            key={conv.id}
            type="button"
            className={cn(
              "w-full text-left px-14 py-10 rounded-10 border transition-all group",
              currentId === conv.id
                ? "bg-heat-4 border-heat-20"
                : "border-border-faint bg-accent-white hover:border-heat-40 hover:bg-heat-4",
            )}
            onClick={() => onSelect(conv.id, conv.title)}
          >
            <span className="text-body-medium text-black-alpha-48 group-hover:text-accent-black transition-colors line-clamp-2">
              {conv.title}
            </span>
            <div className="text-mono-x-small text-black-alpha-24 mt-4">
              {formatRelativeTime(conv.updated_at)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
