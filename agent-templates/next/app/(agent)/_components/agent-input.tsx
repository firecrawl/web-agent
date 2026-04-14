"use client";

import { useState } from "react";
import type { AgentConfig } from "@/agent-core-types";
import ModelSelector from "./model-selector";
import SkillSelector from "./skill-selector";
import SubAgentConfigurator from "./sub-agent-config";
import { cn } from "@/utils/cn";

function GlobeIcon() {
  return (
    <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
      <path
        d="M12 19.7083C16.2572 19.7083 19.7083 16.2572 19.7083 12C19.7083 7.74276 16.2572 4.29163 12 4.29163M12 19.7083C7.74276 19.7083 4.29163 16.2572 4.29163 12C4.29163 7.74276 7.74276 4.29163 12 4.29163M12 19.7083C10.044 19.7083 8.45829 16.2572 8.45829 12C8.45829 7.74276 10.044 4.29163 12 4.29163M12 19.7083C13.956 19.7083 15.5416 16.2572 15.5416 12C15.5416 7.74276 13.956 4.29163 12 4.29163M19.5 12H4.49996"
        stroke="#262626"
        strokeLinecap="square"
        strokeOpacity="0.32"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M11.6667 4.79163L16.875 9.99994M16.875 9.99994L11.6667 15.2083M16.875 9.99994H3.125"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Section({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border-t border-black-alpha-5">
      <button
        type="button"
        className="w-full flex items-center justify-between py-10 px-16 text-label-small text-black-alpha-56 hover:text-accent-black transition-colors"
        onClick={() => setOpen(!open)}
      >
        {title}
        <svg
          className={cn("w-16 h-16 transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className="px-16 pb-12">{children}</div>}
    </div>
  );
}

export default function AgentInput({
  config,
  onConfigChange,
  onRun,
  onStop,
  isRunning,
}: {
  config: AgentConfig;
  onConfigChange: (config: AgentConfig) => void;
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="max-w-552 mx-auto w-full relative">
      {/* Hero-style floating card */}
      <div
        className="relative bg-accent-white rounded-20 overflow-hidden"
        style={{
          boxShadow:
            "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 0px 0px 10px #F9F9F9",
        }}
      >
        {/* Main prompt textarea */}
        <div className="p-16">
          <textarea
            className="w-full bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 resize-none focus:outline-none min-h-80"
            placeholder="What do you want to research? e.g. 'Find pricing for the top 5 cloud hosting providers'"
            rows={3}
            value={config.prompt}
            onChange={(e) =>
              onConfigChange({ ...config, prompt: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey && !isRunning) {
                e.preventDefault();
                onRun();
              }
            }}
          />
        </div>

        {/* URLs input */}
        <label className="px-16 pb-12 flex gap-8 items-center w-full border-b border-black-alpha-5">
          <GlobeIcon />
          <input
            className="w-full bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-32 focus:outline-none"
            placeholder="URLs (optional, comma-separated)"
            type="text"
            value={config.urls?.join(", ") ?? ""}
            onChange={(e) =>
              onConfigChange({
                ...config,
                urls: e.target.value
                  ? e.target.value.split(",").map((u) => u.trim())
                  : [],
              })
            }
          />
        </label>

        {/* Collapsible sections */}
        <Section title="Model & API Key" defaultOpen>
          <ModelSelector
            value={config.model}
            onChange={(model) => onConfigChange({ ...config, model })}
          />
        </Section>

        <Section title="Skills">
          <SkillSelector
            selected={config.skills}
            onChange={(skills) => onConfigChange({ ...config, skills })}
          />
        </Section>

        <Section title="Subagents">
          <SubAgentConfigurator
            agents={config.subAgents}
            onChange={(subAgents) => onConfigChange({ ...config, subAgents })}
          />
        </Section>

        <Section title="JSON Schema">
          <textarea
            className="w-full bg-background-base border border-black-alpha-8 rounded-8 px-10 py-8 text-mono-small placeholder:text-black-alpha-32 focus:border-heat-100 focus:outline-none transition-all min-h-80 resize-y font-mono"
            placeholder='{"type": "array", "items": {"type": "object", "properties": {...}}}'
            value={
              config.schema ? JSON.stringify(config.schema, null, 2) : ""
            }
            onChange={(e) => {
              try {
                const parsed = e.target.value
                  ? JSON.parse(e.target.value)
                  : undefined;
                onConfigChange({ ...config, schema: parsed });
              } catch {
                // Don't update on invalid JSON — user is still typing
              }
            }}
          />
        </Section>

        {/* Submit bar */}
        <div className="p-10 flex justify-between items-center border-t border-black-alpha-5">
          <div className="text-body-small text-black-alpha-32">
            {config.maxSteps ?? 20} max steps
          </div>

          {isRunning ? (
            <button
              type="button"
              className="flex items-center gap-6 px-16 py-8 rounded-10 bg-black-alpha-4 text-label-medium text-accent-black hover:bg-black-alpha-6 active:scale-[0.99] transition-all"
              onClick={onStop}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "flex items-center gap-6 rounded-10 transition-all",
                config.prompt.trim()
                  ? "bg-heat-100 hover:bg-[color:var(--heat-90)] text-accent-white px-16 py-8"
                  : "bg-heat-100 text-accent-white p-8",
              )}
              disabled={!config.prompt.trim()}
              onClick={onRun}
            >
              {config.prompt.trim() ? (
                <span className="text-label-medium">Run Agent</span>
              ) : (
                <ArrowIcon />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
