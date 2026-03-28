"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AgentConfig, ModelConfig } from "@/lib/types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@/lib/config/models";
import { useACPChat } from "./hooks/use-acp-chat";
import ProviderModelIcon from "./components/provider-icon";
import AgentInput from "./components/agent-input";
import PlanVisualization from "./components/plan-visualization";
import OutputPanel from "./components/output-panel";
import SettingsPanel from "./components/settings-panel";
import CsvUpload from "./components/csv-upload";
import HistoryPanel from "./components/history-panel";
import Sidebar from "./components/sidebar";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import Link from "next/link";
import { cn } from "@/utils/cn";

function GitHubIcon() {
  return (
    <svg height="20" viewBox="0 0 24 24" width="20" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function HeaderLinks() {
  return (
    <div className="flex items-center gap-6">
      <Link
        href="/docs"
        className="px-10 py-6 rounded-8 text-label-small text-black-alpha-48 hover:bg-black-alpha-4 hover:text-accent-black transition-all"
      >
        API Docs
      </Link>
      <a
        href="https://github.com/mendableai/firecrawl-agent"
        target="_blank"
        rel="noopener noreferrer"
        className="p-6 rounded-8 text-black-alpha-40 hover:bg-black-alpha-4 hover:text-accent-black transition-all"
      >
        <GitHubIcon />
      </a>
    </div>
  );
}

const defaultModel: ModelConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
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
  acpAgents,
}: {
  value: ModelConfig;
  onChange: (config: ModelConfig) => void;
  onClose: () => void;
  acpAgents?: { name: string; bin: string; displayName: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const providerKeys = Object.keys(AVAILABLE_MODELS) as string[];

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-6 w-280 bg-accent-white rounded-12 border border-border-muted overflow-hidden"
      style={{
        boxShadow:
          "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
      }}
    >
      {providerKeys.filter((p) => p !== "acp").map((providerId) => {
        const meta = PROVIDER_META[providerId];
        const models = AVAILABLE_MODELS[providerId];
        if (!models) return null;
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
                  onChange({ ...value, provider: providerId as ModelConfig["provider"], model: m.id });
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
      {acpAgents && acpAgents.length > 0 && (
        <div>
          <div className="flex items-center gap-6 text-label-x-small text-black-alpha-40 px-12 pt-8 pb-2">
            <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
            </svg>
            Local Agent (ACP)
          </div>
          {acpAgents.map((a) => (
            <button
              key={a.bin}
              type="button"
              className={cn(
                "w-full text-left px-12 py-6 text-body-medium transition-all flex items-center gap-8",
                value.provider === "acp" && value.model === a.bin
                  ? "bg-heat-8 text-heat-100"
                  : "hover:bg-black-alpha-2 text-accent-black",
              )}
              onClick={() => {
                onChange({ provider: "acp", model: a.bin, bin: a.bin });
                onClose();
              }}
            >
              <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
              {a.displayName}
            </button>
          ))}
        </div>
      )}
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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [showSaveSkill, setShowSaveSkill] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [savedSkillPath, setSavedSkillPath] = useState<string | null>(null);
  const [generatedSkillContent, setGeneratedSkillContent] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);


  const [acpAgents, setAcpAgents] = useState<{ name: string; bin: string; displayName: string; available: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then(setSkills)
      .catch(() => setSkills([]));
    fetch("/api/acp/agents")
      .then((r) => r.json())
      .then((agents) => setAcpAgents(agents.filter((a: { available: boolean }) => a.available)))
      .catch(() => setAcpAgents([]));
  }, []);

  const isACP = config.model.provider === "acp";

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { config },
      }),
    [config],
  );

  const sdkChat = useChat({ transport });
  const acpChat = useACPChat();

  const messages = isACP ? acpChat.messages : sdkChat.messages;
  const status = isACP ? acpChat.status : sdkChat.status;
  const stop = isACP ? acpChat.stop : sdkChat.stop;

  const sendMessage = useCallback((opts: { text: string }) => {
    if (isACP) {
      acpChat.sendMessage({
        text: opts.text,
        bin: config.model.bin ?? config.model.model,
      });
    } else {
      sdkChat.sendMessage(opts);
    }
  }, [isACP, config.model, acpChat, sdkChat]);

  const isRunning = status === "streaming" || status === "submitted";
  // Compute session stats from messages
  const sessionStats = useMemo(() => {
    let firecrawlCredits = 0;
    let toolCalls = 0;
    let agentTurns = 0;
    let inputChars = 0;
    let outputChars = 0;

    for (const msg of messages) {
      if (msg.role === "assistant") agentTurns++;
      for (const part of msg.parts) {
        if (part.type === "text") {
          if (msg.role === "user") inputChars += part.text.length;
          else outputChars += part.text.length;
        }
        const p = part as Record<string, unknown>;
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          toolCalls++;
          const output = (p.output ?? p.result) as Record<string, unknown> | undefined;
          if (output && typeof output === "object") {
            const credits = typeof output.creditsUsed === "number" ? output.creditsUsed : 0;
            firecrawlCredits += credits;
          }
        }
      }
    }

    // Rough token estimate: ~4 chars per token
    const estimatedTokens = Math.round((inputChars + outputChars) / 4);

    return { firecrawlCredits, toolCalls, agentTurns, estimatedTokens };
  }, [messages]);

  const prevIsRunning = useRef(false);

  useEffect(() => {
    if (prevIsRunning.current && !isRunning && messages.length > 0) {
      // Agent just finished -- fetch contextual suggestions
      const lastTexts = messages
        .filter((m) => m.role === "assistant")
        .flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text))
        .slice(-3)
        .join("\n");
      const summary = lastTexts.slice(0, 1000);

      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: config.prompt, summary }),
      })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, messages, config.prompt]);

  const handleSaveSkill = async () => {
    if (!skillName.trim() || savingSkill) return;
    setSavingSkill(true);

    // Extract a flat list of messages for the API
    const flatMessages = messages.flatMap((msg) =>
      msg.parts.map((part) => {
        if (part.type === "text") {
          return { role: msg.role, text: part.text };
        }
        const p = part as Record<string, unknown>;
        if (p.toolName) {
          return {
            role: msg.role,
            toolName: String(p.toolName),
            input: p.input ?? p.args,
            output: p.output,
          };
        }
        return null;
      }).filter(Boolean),
    );

    try {
      const res = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skillName.trim(),
          messages: flatMessages,
          prompt: config.prompt,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Server error (${res.status})`;
        try { msg = JSON.parse(text).error ?? msg; } catch { /* use default */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedSkillPath(data.path);
      setGeneratedSkillContent(data.content ?? null);
    } catch (err) {
      alert(`Failed to save skill: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingSkill(false);
    }
  };

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
      <div className="min-h-screen bg-background-base flex flex-col items-center justify-center px-16 relative">
        <div className="absolute top-12 right-20">
          <HeaderLinks />
        </div>
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
                    acpAgents={acpAgents}
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

        {/* Example prompts */}
        <div className="w-full max-w-640 mt-20">
          <div className="grid grid-cols-2 gap-8">
            {[
              { icon: "🔍", text: "Search for the best open-source dev tools in 2025, scrape each homepage, and compare features" },
              { icon: "📰", text: "Go to Hacker News, get the top 5 stories, scrape each link, and summarize what's trending" },
              { icon: "🤖", text: "Find the top 10 AI startups that raised funding this year, scrape their sites, and interact with their pricing pages" },
              { icon: "🏷️", text: "Scrape Vercel and Netlify pricing pages, interact with the feature comparison tables, and return a side-by-side breakdown" },
            ].map((ex, i) => (
              <button
                key={i}
                type="button"
                className="text-left px-14 py-10 rounded-10 border border-border-faint bg-accent-white hover:border-heat-40 hover:bg-heat-4 transition-all group"
                onClick={() => {
                  setConfig({ ...config, prompt: ex.text });
                }}
              >
                <span className="text-body-medium text-black-alpha-48 group-hover:text-accent-black transition-colors">
                  {ex.icon} {ex.text}
                </span>
              </button>
            ))}
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
    <div className="h-screen bg-background-base flex flex-col">
      <header className="border-b border-border-faint px-20 py-12 flex items-center gap-10 flex-shrink-0">
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
          <HeaderLinks />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentId={conversationId ?? undefined}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSelect={(id, title) => {
            setConfig({ ...config, prompt: title });
            setConversationId(id);
            setHasSubmitted(true);
          }}
          onNew={() => {
            setHasSubmitted(false);
            setConfig(defaultConfig);
            setConversationId(null);
            stop();
          }}
        />

      <div className="flex-1 overflow-y-auto">
      <div className={cn("mx-auto px-20 py-24 transition-all duration-200", sidebarCollapsed || studioCollapsed ? "max-w-900" : "max-w-700")}>
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

        {/* Output panel (formatted result if available) */}
        {!isRunning && messages.length > 0 && (
          <OutputPanel
            messages={messages}
            onRequestFormat={(format) => {
              const prompts: Record<string, string> = {
                json: "Format all the collected data as JSON using formatOutput.",
                csv: "Format all the collected data as CSV using formatOutput.",
                markdown: "Format all the collected data as a markdown report using formatOutput with format \"text\".",
                html: "Format all the collected data as a clean HTML document using formatOutput with format \"text\". Use proper HTML tags, tables where appropriate, and inline styles for readability.",
              };
              setSidebarCollapsed(true);
              sendMessage({ text: prompts[format] });
            }}
          />
        )}

        {/* Bottom section */}
        {!isRunning && messages.length > 0 && (
          <div className="mt-20 pt-16 border-t border-border-faint">
            {/* Contextual follow-up suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-6 mb-10">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="px-12 py-6 rounded-full text-body-small text-black-alpha-56 border border-border-faint bg-accent-white hover:border-heat-100 hover:text-heat-100 hover:bg-heat-4 transition-all"
                    onClick={() => {
                      setSuggestions([]);
                      sendMessage({ text: s });
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Follow-up input */}
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
                  placeholder="Ask a follow-up..."
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followUp.trim()) {
                      e.preventDefault();
                      setSuggestions([]);
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
                      setSuggestions([]);
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

        {/* Session stats scoreboard */}
        {messages.length > 0 && (
          <div className="mt-16 mb-8 flex items-center justify-end gap-12">
            {sessionStats.firecrawlCredits > 0 && (
              <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                {sessionStats.firecrawlCredits} credit{sessionStats.firecrawlCredits !== 1 ? "s" : ""}
              </div>
            )}
            <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              {sessionStats.agentTurns} turn{sessionStats.agentTurns !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
              {sessionStats.toolCalls} tool call{sessionStats.toolCalls !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
              <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
              ~{sessionStats.estimatedTokens > 1000 ? `${(sessionStats.estimatedTokens / 1000).toFixed(1)}k` : sessionStats.estimatedTokens} tokens
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Studio panel -- right side, appears after agent finishes */}
      {!isRunning && messages.length > 0 && (
        <div className={cn(
          "h-full border-l border-border-faint bg-background-base flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200",
          studioCollapsed ? "w-48" : "w-260",
        )}>
          <div className={cn("p-12 flex items-center", studioCollapsed ? "justify-center" : "gap-8")}>
            {!studioCollapsed && <h3 className="text-label-medium text-accent-black flex-1">Studio</h3>}
            <button
              type="button"
              className="p-6 rounded-6 text-black-alpha-40 hover:bg-black-alpha-4 hover:text-accent-black transition-all flex-shrink-0"
              onClick={() => setStudioCollapsed(!studioCollapsed)}
              title={studioCollapsed ? "Expand studio" : "Collapse studio"}
            >
              <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {studioCollapsed ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
              </svg>
            </button>
          </div>

          {!studioCollapsed && <div className="px-12 pb-16 flex flex-col gap-6 overflow-y-auto">
            {/* Export cards */}
            {([
              { id: "json" as const, label: "JSON", desc: "Structured data", color: "bg-heat-4 border-heat-20 hover:border-heat-40", icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" /></svg> },
              { id: "csv" as const, label: "CSV", desc: "Spreadsheet table", color: "bg-accent-forest/[0.04] border-accent-forest/15 hover:border-accent-forest/30", icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18M9 6v12M15 6v12" /></svg> },
              { id: "markdown" as const, label: "Report", desc: "Markdown summary", color: "bg-accent-amethyst/[0.04] border-accent-amethyst/15 hover:border-accent-amethyst/30", icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg> },
              { id: "html" as const, label: "HTML", desc: "Styled document", color: "bg-[#fff4e6] border-[#ffe0b2] hover:border-[#ffcc80]", icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></svg> },
            ]).map((card) => (
              <button
                key={card.id}
                type="button"
                className={cn(
                  "w-full text-left px-14 py-12 rounded-10 border transition-all",
                  card.color,
                )}
                onClick={() => {
                  const prompts: Record<string, string> = {
                    json: "Format all the collected data as JSON using formatOutput.",
                    csv: "Format all the collected data as CSV using formatOutput.",
                    markdown: "Format all the collected data as a markdown report using formatOutput with format \"text\".",
                    html: "Format all the collected data as a clean HTML document using formatOutput with format \"text\". Use proper HTML tags, tables where appropriate, and inline styles for readability.",
                  };
                  setSidebarCollapsed(true);
                  sendMessage({ text: prompts[card.id] });
                }}
              >
                <div className="flex items-center gap-8">
                  <span className="text-black-alpha-48">{card.icon}</span>
                  <div>
                    <div className="text-label-small text-accent-black">{card.label}</div>
                    <div className="text-body-small text-black-alpha-32">{card.desc}</div>
                  </div>
                  <svg fill="none" height="14" viewBox="0 0 24 24" width="14" className="ml-auto text-black-alpha-24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              </button>
            ))}

            <div className="h-px bg-border-faint my-4" />

            {/* Save as Skill */}
            {!generatedSkillContent ? (
              showSaveSkill ? (
                <div className="flex flex-col gap-6">
                  <input
                    className="w-full px-12 py-8 rounded-8 border border-border-faint text-body-small text-accent-black placeholder:text-black-alpha-24 focus:outline-none focus:border-accent-forest transition-colors"
                    placeholder="Skill name..."
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && skillName.trim() && !savingSkill) { e.preventDefault(); handleSaveSkill(); }
                      if (e.key === "Escape") { setShowSaveSkill(false); setSkillName(""); }
                    }}
                  />
                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="flex-1 px-10 py-6 rounded-8 text-label-small text-black-alpha-48 hover:bg-black-alpha-4 transition-all"
                      onClick={() => { setShowSaveSkill(false); setSkillName(""); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 px-10 py-6 rounded-8 text-label-small transition-all",
                        skillName.trim() && !savingSkill ? "bg-accent-forest text-white hover:bg-accent-forest/90" : "bg-black-alpha-8 text-black-alpha-24 cursor-not-allowed",
                      )}
                      disabled={!skillName.trim() || savingSkill}
                      onClick={handleSaveSkill}
                    >
                      {savingSkill ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-left px-14 py-12 rounded-10 border border-accent-forest/15 bg-accent-forest/[0.04] hover:border-accent-forest/30 transition-all"
                  onClick={() => { setShowSaveSkill(true); setSavedSkillPath(null); setGeneratedSkillContent(null); }}
                >
                  <div className="flex items-center gap-8">
                    <svg fill="none" height="16" viewBox="0 0 24 24" width="16" className="text-accent-forest" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                    </svg>
                    <div>
                      <div className="text-label-small text-accent-black">Save as Skill</div>
                      <div className="text-body-small text-black-alpha-32">Reusable workflow</div>
                    </div>
                    <svg fill="none" height="14" viewBox="0 0 24 24" width="14" className="ml-auto text-black-alpha-24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </button>
              )
            ) : (
              <div className="rounded-10 border border-accent-forest/20 bg-accent-forest/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-12 py-8 border-b border-accent-forest/10">
                  <div className="flex items-center gap-6">
                    <svg className="w-14 h-14 text-accent-forest" fill="none" viewBox="0 0 16 16"><path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-label-small text-accent-black">Skill saved</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="p-3 rounded-4 text-black-alpha-32 hover:bg-black-alpha-4 hover:text-accent-black transition-all"
                      onClick={() => {
                        const blob = new Blob([generatedSkillContent], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${skillName || "skill"}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    </button>
                    <button
                      type="button"
                      className="p-3 rounded-4 text-black-alpha-32 hover:bg-black-alpha-4 hover:text-accent-black transition-all"
                      onClick={() => { setGeneratedSkillContent(null); setShowSaveSkill(false); setSkillName(""); setSavedSkillPath(null); }}
                    >
                      <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="p-12 max-h-300 overflow-auto">
                  <pre className="text-mono-x-small text-accent-black whitespace-pre-wrap leading-relaxed">{generatedSkillContent}</pre>
                </div>
              </div>
            )}
          </div>}
        </div>
      )}

      </div>


    </div>
  );
}
