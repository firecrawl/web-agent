"use client";

import { useState, useEffect } from "react";
import { getHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { cn } from "@/utils/cn";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HistoryPanel({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="mt-16">
      <button
        type="button"
        className="text-body-small text-black-alpha-32 hover:text-black-alpha-48 transition-colors"
        onClick={() => setShow(!show)}
      >
        {show ? "Hide" : "Recent"} ({history.length})
      </button>

      {show && (
        <div className="mt-8 flex flex-col gap-2 max-h-240 overflow-y-auto">
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="w-full text-left px-12 py-8 rounded-8 hover:bg-black-alpha-2 transition-all group"
              onClick={() => onSelect(entry.prompt)}
            >
              <div className="text-body-medium text-accent-black truncate group-hover:text-heat-100 transition-colors">
                {entry.prompt}
              </div>
              <div className="flex items-center gap-6 text-body-small text-black-alpha-32">
                <span>{entry.model}</span>
                <span>·</span>
                <span>{formatRelativeTime(entry.timestamp)}</span>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="text-body-small text-black-alpha-24 hover:text-accent-crimson transition-colors py-4"
            onClick={() => {
              clearHistory();
              setHistory([]);
            }}
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
