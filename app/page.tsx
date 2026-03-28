"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AgentConfig, ModelConfig } from "@/lib/types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@/lib/config/models";
import ProviderModelIcon from "./components/provider-icon";
import AgentInput from "./components/agent-input";
import PlanVisualization from "./components/plan-visualization";
import OutputPanel from "./components/output-panel";
import SettingsPanel from "./components/settings-panel";
import CsvUpload from "./components/csv-upload";
import HistoryPanel from "./components/history-panel";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import { cn } from "@/utils/cn";

const defaultModel: ModelConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
};

const defaultConfig: AgentConfig = {
  prompt: "",
  urls: [],
  schema: undefined,
  model: defaultModel,
  skills: [],
  subAgents: [],
  maxSteps: 20,
};

interface SkillInfo {
  name: string;
  description: string;
}

function SkillsIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SkillsDropdown({
  skills,
  selected,
  onChange,
  onClose,
}: {
  skills: SkillInfo[];
  selected: string[];
  onChange: (skills: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (skills.length === 0) {
    return (
      <div
        ref={ref}
        className="absolute bottom-full left-0 mb-6 w-320 bg-accent-white rounded-12 border border-border-muted p-12"
        style={{
          boxShadow:
            "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
        }}
      >
        <div className="text-body-small text-black-alpha-48">
          No skills found. Add SKILL.md files to .agents/skills/
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-6 w-360 bg-accent-white rounded-12 border border-border-muted overflow-hidden"
      style={{
        boxShadow:
          "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="p-8 border-b border-border-faint">
        <div className="text-label-small text-black-alpha-48 px-8">
          Select skills
        </div>
      </div>
      <div className="max-h-280 overflow-y-auto p-4">
        {skills.map((skill) => {
          const active = selected.includes(skill.name);
          return (
            <button
              key={skill.name}
              type="button"
              className={cn(
                "w-full text-left px-10 py-8 rounded-8 transition-all",
                active
                  ? "bg-heat-8"
                  : "hover:bg-black-alpha-2",
              )}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((s) => s !== skill.name)
                    : [...selected, skill.name],
                )
              }
            >
              <div className="flex items-center gap-8">
                <div
                  className={cn(
                    "w-14 h-14 rounded-4 border-2 flex-shrink-0 flex items-center justify-center transition-all",
                    active
                      ? "bg-heat-100 border-heat-100"
                      : "border-black-alpha-16",
                  )}
                >
                  {active && (
                    <svg
                      viewBox="0 0 16 16"
                      className="text-white w-10 h-10"
                    >
                      <path
                        d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1-5.5 5.5z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-label-small text-accent-black">
                    {skill.name}
                  </div>
                  <div className="text-body-small text-black-alpha-48 truncate">
                    {skill.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModelDropdown({
  value,
  onChange,
  onClose,
}: {
  value: ModelConfig;
  onChange: (config: ModelConfig) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const providerKeys = Object.keys(PROVIDER_META) as Provider[];

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-6 w-280 bg-accent-white rounded-12 border border-border-muted overflow-hidden"
      style={{
        boxShadow:
          "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
      }}
    >
      {providerKeys.map((providerId) => {
        const meta = PROVIDER_META[providerId];
        const models = AVAILABLE_MODELS[providerId];
        return (
          <div key={providerId}>
            <div className="flex items-center gap-6 text-label-x-small text-black-alpha-40 px-12 pt-8 pb-2">
              <ProviderModelIcon icon={meta.icon} size={14} />
              {meta.name}
            </div>
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  "w-full text-left px-12 py-6 text-body-medium transition-all flex items-center gap-8",
                  value.provider === providerId && value.model === m.id
                    ? "bg-heat-8 text-heat-100"
                    : "hover:bg-black-alpha-2 text-accent-black",
                )}
                onClick={() => {
                  onChange({ ...value, provider: providerId, model: m.id });
                  onClose();
                }}
              >
                <ProviderModelIcon icon={m.icon} size={16} />
                {m.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentPage() {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { config },
      }),
    [config],
  );

  const { messages, sendMessage, status, stop } = useChat({ transport });

  const isRunning = status === "streaming" || status === "submitted";

  const onRun = () => {
    if (!config.prompt.trim()) return;
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(id);
    setHasSubmitted(true);
    // Save to SQLite
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: config.prompt.slice(0, 100),
        config,
      }),
    });
    sendMessage({ text: config.prompt });
  };

  const currentModel = AVAILABLE_MODELS[config.model.provider]?.find(
    (m) => m.id === config.model.model,
  );
  const currentModelName = currentModel?.name ?? config.model.model;
  const currentModelIcon = currentModel?.icon ?? "openai";

  // First screen: clean input bar like Google/Lovable
  if (!hasSubmitted) {
    return (
      <div className="min-h-screen bg-background-base flex flex-col items-center justify-center px-16">
        <div className="flex flex-col items-center gap-12 mb-32 -mt-60">
          <SymbolColored width={56} height={80} />
          <h1 className="text-title-h2 text-accent-black text-center">
            Firecrawl Agent
          </h1>
        </div>

        {/* Input card */}
        <div
          className="w-full max-w-640 relative bg-accent-white rounded-16 overflow-visible"
          style={{
            boxShadow:
              "0px 4px 32px -4px rgba(0, 0, 0, 0.08), 0px 2px 12px -2px rgba(0, 0, 0, 0.04), 0px 0px 0px 1px rgba(0, 0, 0, 0.06)",
          }}
        >
          {/* Text area */}
          <div className="px-20 pt-16 pb-8">
            <textarea
              className="w-full bg-transparent text-body-large text-accent-black placeholder:text-black-alpha-32 focus:outline-none resize-none"
              placeholder="Find pricing for the top 5 cloud hosting providers..."
              rows={2}
              autoFocus
              value={config.prompt}
              onChange={(e) =>
                setConfig({ ...config, prompt: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && config.prompt.trim()) {
                  e.preventDefault();
                  onRun();
                }
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-12 pb-10 pt-4">
            <div className="flex items-center gap-4 relative">
              {/* CSV upload */}
              <CsvUpload
                onUpload={(filename, content) =>
                  setConfig({ ...config, csvContext: content })
                }
              />

              {/* Skills button */}
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-6 px-10 py-6 rounded-8 text-label-small transition-all",
                    config.skills.length > 0
                      ? "bg-heat-8 text-heat-100"
                      : "text-black-alpha-48 hover:bg-black-alpha-4",
                  )}
                  onClick={() => {
                    setShowSkills(!showSkills);
                    setShowModel(false);
                  }}
                >
                  <SkillsIcon />
                  <span>
                    {config.skills.length > 0
                      ? `${config.skills.length} skill${config.skills.length > 1 ? "s" : ""}`
                      : "Skills"}
                  </span>
                </button>
                {showSkills && (
                  <SkillsDropdown
                    skills={skills}
                    selected={config.skills}
                    onChange={(s) => setConfig({ ...config, skills: s })}
                    onClose={() => setShowSkills(false)}
                  />
                )}
              </div>

              {/* Model button */}
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-6 px-10 py-6 rounded-8 text-label-small text-black-alpha-48 hover:bg-black-alpha-4 transition-all"
                  onClick={() => {
                    setShowModel(!showModel);
                    setShowSkills(false);
                  }}
                >
                  <ProviderModelIcon icon={currentModelIcon} size={16} />
                  <span>{currentModelName}</span>
                </button>
                {showModel && (
                  <ModelDropdown
                    value={config.model}
                    onChange={(model) => setConfig({ ...config, model })}
                    onClose={() => setShowModel(false)}
                  />
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              className={cn(
                "rounded-8 p-8 transition-all",
                config.prompt.trim()
                  ? "bg-heat-100 hover:bg-[color:var(--heat-90)] text-accent-white active:scale-95"
                  : "bg-black-alpha-8 text-black-alpha-24 cursor-not-allowed",
              )}
              disabled={!config.prompt.trim()}
              onClick={onRun}
            >
              <svg fill="none" height="18" viewBox="0 0 20 20" width="18">
                <path
                  d="M3.125 10H16.875M11.6667 4.79163L16.875 9.99994L11.6667 15.2083"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* History */}
        <div className="w-full max-w-640">
          <HistoryPanel
            onSelect={(id, title) => setConfig({ ...config, prompt: title })}
            currentId={conversationId ?? undefined}
          />
        </div>
      </div>
    );
  }

  // After submission: centered activity feed
  return (
    <div className="min-h-screen bg-background-base">
      <header className="border-b border-border-faint px-20 py-12 flex items-center gap-10">
        <button
          type="button"
          className="flex items-center gap-10 hover:opacity-80 transition-opacity"
          onClick={() => {
            setHasSubmitted(false);
            stop();
          }}
        >
          <SymbolColored width={22} height={32} />
          <h1 className="text-title-h5 text-accent-black">Firecrawl Agent</h1>
        </button>
        <div className="ml-auto flex items-center gap-6">
          {isRunning && (
            <button
              type="button"
              className="px-12 py-6 rounded-8 text-label-small bg-black-alpha-4 text-accent-black hover:bg-black-alpha-6 transition-all"
              onClick={stop}
            >
              Stop
            </button>
          )}
          <SettingsPanel config={config} onChange={setConfig} />
        </div>
      </header>

      <div className="max-w-700 mx-auto px-20 py-24">
        {/* Query display */}
        <div className="mb-20">
          <div className="text-title-h4 text-accent-black mb-6">
            {config.prompt}
          </div>
          <div className="flex items-center gap-8 text-body-small text-black-alpha-40">
            <ProviderModelIcon icon={currentModelIcon} size={14} />
            <span>{currentModelName}</span>
            {config.skills.length > 0 && (
              <>
                <span className="text-black-alpha-16">·</span>
                <span>{config.skills.length} skill{config.skills.length > 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <PlanVisualization messages={messages} isRunning={isRunning} />

        {/* Output + Skills — only after completion */}
        {!isRunning && messages.length > 0 && (
          <>
            <OutputPanel messages={messages} />
          </>
        )}

        {/* Follow-up input */}
        {!isRunning && messages.length > 0 && (
          <div className="mt-20 pt-16 border-t border-border-faint">
            <div
              className="bg-accent-white rounded-12 overflow-hidden"
              style={{
                boxShadow:
                  "0px 2px 12px -2px rgba(0,0,0,0.04), 0px 0px 0px 1px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center gap-8 px-16 py-12">
                <input
                  className="flex-1 bg-transparent text-body-medium text-accent-black placeholder:text-black-alpha-32 focus:outline-none"
                  placeholder="Ask a follow-up question..."
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followUp.trim()) {
                      e.preventDefault();
                      sendMessage({ text: followUp });
                      setFollowUp("");
                    }
                  }}
                />
                {followUp.trim() && (
                  <button
                    type="button"
                    className="bg-heat-100 hover:bg-[color:var(--heat-90)] text-accent-white rounded-8 p-6 transition-all active:scale-95"
                    onClick={() => {
                      sendMessage({ text: followUp });
                      setFollowUp("");
                    }}
                  >
                    <svg fill="none" height="16" viewBox="0 0 20 20" width="16">
                      <path
                        d="M3.125 10H16.875M11.6667 4.79163L16.875 9.99994L11.6667 15.2083"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
