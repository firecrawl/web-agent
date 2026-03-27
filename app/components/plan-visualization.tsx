"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/utils/cn";

// --- Icons ---

function GlobeIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" className="text-black-alpha-32">
      <path
        d="M12 19.7C16.26 19.7 19.7 16.26 19.7 12S16.26 4.3 12 4.3 4.3 7.74 4.3 12s3.44 7.7 7.7 7.7zM12 19.7c-1.96 0-3.54-3.44-3.54-7.7S10.04 4.3 12 4.3s3.54 3.44 3.54 7.7-1.58 7.7-3.54 7.7zM19.5 12H4.5"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SearchQIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" className="text-black-alpha-32">
      <path
        d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" className="text-black-alpha-32">
      <path
        d="M16 18l6-6-6-6M8 6l-6 6 6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SkillIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" className="text-black-alpha-32">
      <path
        d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zM8 14h8l2 8H6l2-8z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Favicon({ domain }: { domain: string }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      width={16}
      height={16}
      alt=""
      className="rounded-2"
    />
  );
}

function ToolIconPill({ name }: { name: string }) {
  const isSearch = name === "search";
  const isScrape = name === "scrape" || name === "interact" || name === "map";
  const isSubagent = name.startsWith("subagent_");
  const isSkill = name === "load_skill" || name === "read_skill_resource";

  return (
    <div className="w-32 h-32 rounded-8 border border-black-alpha-8 flex-center flex-shrink-0 bg-accent-white">
      {isSearch && <SearchQIcon />}
      {isScrape && <GlobeIcon />}
      {isSubagent && <CodeIcon />}
      {isSkill && <SkillIcon />}
      {!isSearch && !isScrape && !isSubagent && !isSkill && <GlobeIcon />}
    </div>
  );
}

// --- Data extraction ---

interface ToolCallInfo {
  id: string;
  name: string;
  input: unknown;
  status: "running" | "complete";
}

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

interface TimelineItem {
  type: "text" | "tool-group" | "skill";
  text?: string;
  calls?: ToolCallInfo[];
  skillName?: string;
}

function extractTimeline(messages: UIMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let currentGroup: ToolCallInfo[] = [];

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      // Pull out skill loads as separate items
      const skills = currentGroup.filter(
        (c) => c.name === "load_skill" || c.name === "read_skill_resource",
      );
      const rest = currentGroup.filter(
        (c) => c.name !== "load_skill" && c.name !== "read_skill_resource",
      );
      for (const skill of skills) {
        const obj = (skill.input as Record<string, unknown>) ?? {};
        items.push({
          type: "skill",
          skillName: String(obj.name ?? obj.skill ?? "skill"),
        });
      }
      if (rest.length > 0) {
        items.push({ type: "tool-group", calls: [...rest] });
      }
      currentGroup = [];
    }
  };

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (part.type === "text" && part.text.trim()) {
        flushGroup();
        items.push({ type: "text", text: part.text });
      } else if (isToolPart(part)) {
        const p = part as Record<string, unknown>;
        const toolCallId = (p.toolCallId ?? "") as string;
        const state = (p.state ?? "") as string;
        const toolName =
          (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
        const input = p.input ?? p.args;

        const existing = currentGroup.find((c) => c.id === toolCallId);
        if (existing) {
          if (state === "result") existing.status = "complete";
        } else {
          currentGroup.push({
            id: toolCallId,
            name: toolName,
            input,
            status: state === "result" ? "complete" : "running",
          });
        }
      }
    }
  }
  flushGroup();
  return items;
}

function getCallLabel(call: ToolCallInfo): string {
  const obj = (call.input as Record<string, unknown>) ?? {};
  switch (call.name) {
    case "search":
      return `Searched the web for "${obj.query ?? ""}"`;
    case "scrape":
      return `Visited ${obj.url ?? "page"}`;
    case "interact":
      return `Interacted with ${obj.url ?? "page"}`;
    case "map":
      return `Mapped URLs on ${obj.url ?? "site"}`;
    case "formatOutput":
      return `Formatted output as ${obj.format ?? "text"}`;
    default:
      if (call.name.startsWith("subagent_"))
        return String(obj.task ?? "Delegated to sub-agent").slice(0, 100);
      return call.name;
  }
}

function getDomain(call: ToolCallInfo): string | null {
  const obj = (call.input as Record<string, unknown>) ?? {};
  const url = (obj.url ?? "") as string;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

function getCallIcon(call: ToolCallInfo) {
  const domain = getDomain(call);
  if (domain) return <Favicon domain={domain} />;
  if (call.name === "search") return <SearchQIcon />;
  if (call.name.startsWith("subagent_")) return <CodeIcon />;
  return <GlobeIcon />;
}

// --- Components ---

function ToolGroup({ calls }: { calls: ToolCallInfo[] }) {
  const [expanded, setExpanded] = useState(false);
  const allComplete = calls.every((c) => c.status === "complete");

  return (
    <div className="my-8">
      {/* Collapsed: icon pills row */}
      {!expanded && (
        <button
          type="button"
          className="flex items-center gap-4 flex-wrap"
          onClick={() => setExpanded(true)}
        >
          {calls.slice(0, 10).map((call) => (
            <ToolIconPill key={call.id} name={call.name} />
          ))}
          {calls.length > 10 && (
            <span className="w-32 h-32 rounded-8 border border-black-alpha-8 flex-center text-mono-small text-black-alpha-32 bg-accent-white">
              ···
            </span>
          )}
          <span className="text-body-medium text-black-alpha-40 ml-4">
            {calls.length} action{calls.length > 1 ? "s" : ""}
            {!allComplete && (
              <span className="ml-4 inline-block w-4 h-4 rounded-full bg-heat-100 animate-pulse" />
            )}
          </span>
        </button>
      )}

      {/* Expanded: list of actions */}
      {expanded && (
        <div>
          <button
            type="button"
            className="flex items-center gap-8 mb-8 text-body-medium text-black-alpha-40 hover:text-black-alpha-64 transition-colors"
            onClick={() => setExpanded(false)}
          >
            <svg
              fill="none"
              height="20"
              viewBox="0 0 20 20"
              width="20"
            >
              <path
                d="M5 12.5l5-5 5 5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
            Show less
          </button>
          <div className="flex flex-col gap-6">
            {calls.map((call) => (
              <div key={call.id} className="flex items-center gap-10 py-2">
                <div className="w-32 h-32 rounded-8 border border-black-alpha-8 flex-center flex-shrink-0 bg-accent-white">
                  {getCallIcon(call)}
                </div>
                <span className="text-body-medium text-black-alpha-48 truncate">
                  {getCallLabel(call)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillLoad({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-10 my-8 py-2">
      <div className="w-32 h-32 rounded-8 border border-black-alpha-8 flex-center flex-shrink-0 bg-accent-white">
        <SkillIcon />
      </div>
      <span className="text-body-medium text-black-alpha-48">
        Loaded {name} skill
      </span>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-10 my-12 py-2">
      <div className="relative w-32 h-32 flex-shrink-0">
        <div className="absolute inset-4 rounded-full border-2 border-black-alpha-8 border-t-heat-100 animate-spin" />
      </div>
    </div>
  );
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
              <div
                key={i}
                className={cn(
                  "text-body-x-large text-accent-black leading-relaxed my-12",
                  "whitespace-pre-wrap",
                )}
              >
                {item.text}
              </div>
            );
          case "tool-group":
            return <ToolGroup key={i} calls={item.calls!} />;
          case "skill":
            return <SkillLoad key={i} name={item.skillName!} />;
          default:
            return null;
        }
      })}

      {isRunning && <ThinkingIndicator />}
    </div>
  );
}
