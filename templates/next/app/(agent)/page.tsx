"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { AgentConfig, ModelConfig } from "@agent-core";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@agent/_lib/config/models";
import { useACPChat } from "./_hooks/use-acp-chat";
import ProviderModelIcon from "./_components/provider-icon";
import AgentInput from "./_components/agent-input";
import PlanVisualization from "./_components/plan-visualization";
import SettingsPanel from "./_components/settings-panel";
import type { UploadedFile } from "@agent-core";
import HistoryPanel from "./_components/history-panel";
import StreamdownBlock from "@/components/shared/streamdown-block";
import Sidebar from "./_components/sidebar";
import ArtifactPanel, { JsonViewer } from "./_components/artifact-panel";
import SymbolColored from "@/components/shared/icons/symbol-colored";
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
      <a
        href="https://github.com/mendableai/firecrawl-agent"
        target="_blank"
        rel="noopener noreferrer"
        className="p-6 rounded-8 text-black-alpha-40 bg-black-alpha-4 hover:bg-black-alpha-8 hover:text-accent-black transition-all"
      >
        <GitHubIcon />
      </a>
    </div>
  );
}

import { getOrchestratorModel } from "@agent/_config";

const defaultModel: ModelConfig = getOrchestratorModel();

const defaultConfig: AgentConfig = {
  prompt: "",
  urls: [],
  schema: undefined,
  model: defaultModel,
  skills: [],
  subAgents: [],
  maxSteps: 20,
};

const PLACEHOLDER_PHRASES = [
  "What data do you want to extract?",
  "Compare pricing across competitor sites...",
  "Scrape job listings and export as CSV...",
  "Research a company and summarize findings...",
  "Monitor product prices across stores...",
  "Extract structured data from any webpage...",
  "Build a lead list with company details...",
  "Audit a site for SEO issues...",
];

function useTypewriter(phrases: string[], typingSpeed = 50, pauseMs = 2000, deleteSpeed = 30) {
  const [display, setDisplay] = useState("");
  const idx = useRef(0);
  const charIdx = useRef(0);
  const deleting = useRef(false);
  const paused = useRef(false);

  useEffect(() => {
    const tick = () => {
      const phrase = phrases[idx.current];
      if (paused.current) return;

      if (!deleting.current) {
        charIdx.current++;
        setDisplay(phrase.slice(0, charIdx.current));
        if (charIdx.current === phrase.length) {
          paused.current = true;
          setTimeout(() => {
            paused.current = false;
            deleting.current = true;
          }, pauseMs);
        }
      } else {
        charIdx.current--;
        setDisplay(phrase.slice(0, charIdx.current));
        if (charIdx.current === 0) {
          deleting.current = false;
          idx.current = (idx.current + 1) % phrases.length;
        }
      }
    };

    const interval = setInterval(tick, deleting.current ? deleteSpeed : typingSpeed);
    return () => clearInterval(interval);
  }, [phrases, typingSpeed, pauseMs, deleteSpeed]);

  return display;
}

interface SkillInfo {
  name: string;
  description: string;
  category?: string;
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

function PlusMenu({
  skills,
  selectedSkills,
  onSkillsChange,
  onUploadClick,
  uploads,
  onRemoveUpload,
  onClose,
  planMode,
  onTogglePlan,
  schema,
  onSchemaChange,
}: {
  skills: SkillInfo[] | null;
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
  onUploadClick: () => void;
  uploads: UploadedFile[];
  onRemoveUpload: (i: number) => void;
  onClose: () => void;
  planMode: boolean;
  onTogglePlan: () => void;
  schema: Record<string, unknown> | undefined;
  onSchemaChange: (schema: Record<string, unknown> | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<"plan" | "upload" | "schema" | "skills" | null>(null);
  const [schemaMode, setSchemaMode] = useState<"describe" | "paste">("describe");
  const [schemaDesc, setSchemaDesc] = useState("");
  const [schemaPaste, setSchemaPaste] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [maxH, setMaxH] = useState(400);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    // Walk up to find the input card container (max-w-640 rounded-16)
    let card = ref.current.parentElement;
    while (card && !card.classList.contains("max-w-640")) {
      card = card.parentElement;
    }
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    setPos({
      left: cardRect.left,
      bottom: window.innerHeight - cardRect.top + 6,
      width: cardRect.width,
    });
    const available = cardRect.top - 12;
    setMaxH(Math.max(200, Math.min(420, available)));
  }, [activePanel]);

  const visibleSkills = (skills ?? []).filter((s) => s.category !== "Export");

  const menuItems: { id: "plan" | "upload" | "schema" | "skills"; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "plan", label: "Plan", badge: planMode ? "on" : undefined,
      icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>,
    },
    {
      id: "upload", label: "Upload", badge: uploads.length > 0 ? String(uploads.length) : undefined,
      icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>,
    },
    {
      id: "schema", label: "Schema", badge: schema ? "set" : undefined,
      icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1" /></svg>,
    },
    {
      id: "skills", label: "Skills", badge: selectedSkills.length > 0 ? String(selectedSkills.length) : undefined,
      icon: <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed bg-accent-white rounded-12 border border-border-muted overflow-hidden flex"
      style={{
        boxShadow: "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
        maxHeight: maxH,
        ...(pos ? { left: pos.left, bottom: pos.bottom, width: pos.width } : { left: 0, bottom: 0 }),
      }}
    >
      {/* Left nav */}
      <div className="w-160 flex-shrink-0 py-6 px-6 flex flex-col gap-1 border-r border-border-faint">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "w-full flex items-center gap-8 px-10 py-8 rounded-8 text-left transition-all",
              activePanel === item.id ? "bg-black-alpha-4" : "hover:bg-black-alpha-2",
            )}
            onClick={() => setActivePanel(activePanel === item.id ? null : item.id)}
          >
            <span className={cn("flex-shrink-0", activePanel === item.id || item.badge ? "text-accent-black" : "text-black-alpha-40")}>{item.icon}</span>
            <span className={cn("text-label-small flex-1", activePanel === item.id ? "text-accent-black" : item.badge ? "text-accent-black" : "text-accent-black")}>{item.label}</span>
            {item.badge && (
              <span className="text-mono-x-small text-heat-100 bg-heat-8 px-4 py-1 rounded-4">{item.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Right panel */}
      {activePanel && (
        <div className="w-360 flex-shrink-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {/* Plan */}
          {activePanel === "plan" && (
            <div className="p-14 flex flex-col gap-8">
              <div className="text-label-medium text-accent-black">Plan before running</div>
              <div className="text-body-small text-black-alpha-48">Generate an execution plan before the agent starts working. Review and approve before any tools are called.</div>
              <button
                type="button"
                className={cn(
                  "w-full py-8 rounded-8 text-label-small transition-all",
                  planMode ? "bg-heat-100 text-white" : "bg-black-alpha-4 text-accent-black hover:bg-black-alpha-8",
                )}
                onClick={() => { onTogglePlan(); }}
              >
                {planMode ? "Enabled" : "Enable"}
              </button>
            </div>
          )}

          {/* Upload */}
          {activePanel === "upload" && (
            <div className="p-14 flex flex-col gap-8">
              <div className="text-label-medium text-accent-black">Upload files</div>
              <div className="text-body-small text-black-alpha-48">Attach CSV, JSON, or text files. They will be available to the agent via bash.</div>
              <button
                type="button"
                className="w-full py-8 rounded-8 text-label-small bg-black-alpha-4 text-accent-black hover:bg-black-alpha-8 transition-all"
                onClick={() => { onUploadClick(); }}
              >
                Choose file
              </button>
              {uploads.length > 0 && (
                <div className="flex flex-col gap-4 pt-4">
                  {uploads.map((f, i) => (
                    <div key={i} className="flex items-center gap-6 px-8 py-6 rounded-8 bg-black-alpha-2">
                      <svg fill="none" height="14" viewBox="0 0 24 24" width="14" className="text-black-alpha-32 flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6" />
                      </svg>
                      <span className="text-body-small text-accent-black flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        className="text-black-alpha-24 hover:text-accent-crimson transition-colors flex-shrink-0"
                        onClick={() => onRemoveUpload(i)}
                      >
                        <svg fill="none" height="10" viewBox="0 0 24 24" width="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schema */}
          {activePanel === "schema" && (
            <div className="p-14 flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div className="text-label-medium text-accent-black">Schema</div>
                {schema && (
                  <button
                    type="button"
                    className="text-mono-x-small text-black-alpha-32 hover:text-accent-crimson transition-colors"
                    onClick={() => { onSchemaChange(undefined); setSchemaDesc(""); setSchemaPaste(""); }}
                  >Clear</button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn("px-10 py-4 rounded-6 text-label-small transition-all", schemaMode === "describe" ? "bg-black-alpha-8 text-accent-black" : "text-black-alpha-32 hover:text-black-alpha-48")}
                  onClick={() => setSchemaMode("describe")}
                >Describe</button>
                <button
                  type="button"
                  className={cn("px-10 py-4 rounded-6 text-label-small transition-all", schemaMode === "paste" ? "bg-black-alpha-8 text-accent-black" : "text-black-alpha-32 hover:text-black-alpha-48")}
                  onClick={() => setSchemaMode("paste")}
                >Paste JSON</button>
              </div>
              {schemaMode === "describe" ? (
                <>
                  <textarea
                    className="w-full bg-black-alpha-4 rounded-8 px-10 py-8 text-body-small text-accent-black placeholder:text-black-alpha-32 focus:outline-none resize-none"
                    rows={3}
                    placeholder="e.g. company name, funding amount, list of investors, website"
                    value={schemaDesc}
                    onChange={(e) => setSchemaDesc(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!schemaDesc.trim() || schemaLoading) return;
                        setSchemaLoading(true);
                        try {
                          const resp = await fetch("/api/schema/generate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ description: schemaDesc }),
                          });
                          const data = await resp.json();
                          if (data.schema) onSchemaChange(data.schema);
                        } catch { /* ignore */ }
                        setSchemaLoading(false);
                      }
                    }}
                  />
                  <div className="text-mono-x-small text-black-alpha-32">
                    {schemaLoading ? "Generating..." : "Enter to generate"}
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    className="w-full bg-black-alpha-4 rounded-8 px-10 py-8 text-mono-x-small text-accent-black placeholder:text-black-alpha-32 focus:outline-none resize-none"
                    rows={5}
                    placeholder='{"type":"object","properties":{"name":{"type":"string"}}}'
                    value={schemaPaste}
                    onChange={(e) => setSchemaPaste(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        try {
                          const parsed = JSON.parse(schemaPaste);
                          onSchemaChange(parsed);
                        } catch { /* ignore */ }
                      }
                    }}
                  />
                  <div className="text-mono-x-small text-black-alpha-32">Enter to apply</div>
                </>
              )}
              {schema && (
                <div className="bg-black-alpha-2 rounded-8 px-10 py-6 text-mono-x-small text-black-alpha-40 break-all max-h-[100px] overflow-auto" style={{ scrollbarWidth: "thin" }}>
                  {JSON.stringify(schema, null, 2)}
                </div>
              )}
            </div>
          )}

          {/* Skills */}
          {activePanel === "skills" && (
            <div className="py-6 px-6 flex flex-col gap-1">
              {visibleSkills.map((skill) => {
                const active = selectedSkills.includes(skill.name);
                return (
                  <button
                    key={skill.name}
                    type="button"
                    className={cn(
                      "w-full text-left px-10 py-6 rounded-8 transition-all",
                      active ? "bg-heat-8" : "hover:bg-black-alpha-2",
                    )}
                    onClick={() =>
                      onSkillsChange(active ? selectedSkills.filter((s) => s !== skill.name) : [...selectedSkills, skill.name])
                    }
                  >
                    <div className="flex items-center gap-8">
                      <div className={cn(
                        "w-14 h-14 rounded-4 border-2 flex-shrink-0 flex items-center justify-center transition-all",
                        active ? "bg-heat-100 border-heat-100" : "border-black-alpha-16",
                      )}>
                        {active && (
                          <svg viewBox="0 0 16 16" className="text-white w-10 h-10">
                            <path d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1-5.5 5.5z" fill="currentColor" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-label-small text-accent-black">{skill.name}</div>
                        <div className="text-body-small text-black-alpha-48 truncate">{skill.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModelDropdown({
  value,
  onChange,
  onClose,
  acpAgents,
  configuredProviders,
}: {
  value: ModelConfig;
  onChange: (config: ModelConfig) => void;
  onClose: () => void;
  acpAgents?: { name: string; bin: string; displayName: string }[];
  configuredProviders?: Set<string>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const providerKeys = (Object.keys(AVAILABLE_MODELS) as string[]).filter(
    (p) => p !== "acp" && (!configuredProviders || configuredProviders.size === 0 || configuredProviders.has(p))
  );

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-6 w-220 bg-accent-white rounded-12 border border-border-muted overflow-hidden"
      style={{
        boxShadow:
          "0px 16px 32px -8px rgba(0,0,0,0.08), 0px 4px 12px -2px rgba(0,0,0,0.04)",
        maxHeight: "min(360px, 50vh)",
      }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: "min(360px, 50vh)", scrollbarWidth: "thin" }}>
      {providerKeys.map((providerId) => {
        const meta = PROVIDER_META[providerId];
        const models = AVAILABLE_MODELS[providerId];
        if (!models) return null;
        return (
          <div key={providerId}>
            <div className="flex items-center gap-6 text-label-x-small text-black-alpha-40 px-10 pt-6 pb-1">
              <ProviderModelIcon icon={meta.icon} size={12} />
              {meta.name}
            </div>
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  "w-full text-left px-10 py-4 text-body-small transition-all flex items-center gap-6",
                  value.provider === providerId && value.model === m.id
                    ? "bg-heat-8 text-heat-100"
                    : "hover:bg-black-alpha-2 text-accent-black",
                )}
                onClick={() => {
                  onChange({ ...value, provider: providerId as ModelConfig["provider"], model: m.id });
                  onClose();
                }}
              >
                <ProviderModelIcon icon={m.icon} size={14} />
                {m.name}
              </button>
            ))}
          </div>
        );
      })}
      {acpAgents && acpAgents.length > 0 && (
        <div>
          <div className="flex items-center gap-6 text-label-x-small text-black-alpha-40 px-10 pt-6 pb-1">
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
            </svg>
            Local Agent (ACP)
          </div>
          {acpAgents.map((a) => (
            <button
              key={a.bin}
              type="button"
              className={cn(
                "w-full text-left px-10 py-4 text-body-small transition-all flex items-center gap-6",
                value.provider === "acp" && value.model === a.bin
                  ? "bg-heat-8 text-heat-100"
                  : "hover:bg-black-alpha-2 text-accent-black",
              )}
              onClick={() => {
                onChange({ provider: "acp", model: a.bin, bin: a.bin });
                onClose();
              }}
            >
              <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
              {a.displayName}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const typingPlaceholder = useTypewriter(PLACEHOLDER_PHRASES);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showPlus, setShowPlus] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);

  const [showSaveSkill, setShowSaveSkill] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [savedSkillPath, setSavedSkillPath] = useState<string | null>(null);
  const [generatedSkillContent, setGeneratedSkillContent] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [planText, setPlanText] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [planEditText, setPlanEditText] = useState("");
  const [sparkMode, setSparkMode] = useState(false);
  const [sparkResult, setSparkResult] = useState<{ data: unknown; status: string; creditsUsed?: number } | null>(null);
  const [sparkLoading, setSparkLoading] = useState(false);
  const [sparkError, setSparkError] = useState<string | null>(null);


  const [acpAgents, setAcpAgents] = useState<{ name: string; bin: string; displayName: string; available: boolean }[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => setSkills(data))
      .catch(() => setSkills([]));
    fetch("/api/acp/agents")
      .then((r) => r.json())
      .then((agents) => setAcpAgents(agents.filter((a: { available: boolean }) => a.available)))
      .catch(() => setAcpAgents([]));
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: { keys: Record<string, { configured: boolean }> }) => {
        const configured = new Set<string>();
        for (const [id, status] of Object.entries(data.keys)) {
          if (status.configured) configured.add(id);
        }
        setConfiguredProviders(configured);
      })
      .catch(() => {});
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    const isText = file.type.startsWith("text/") ||
      /\.(csv|tsv|json|md|txt|xml|yaml|yml|toml|ini|log|sql|html|css|js|ts|py|rb|sh)$/i.test(file.name);
    const onLoad = (content: string) => {
      const uploaded: UploadedFile = { name: file.name, type: file.type || "text/plain", content };
      setConfig((prev) => ({ ...prev, uploads: [...(prev.uploads ?? []), uploaded] }));
    };
    if (isText) {
      reader.onload = () => onLoad(reader.result as string);
      reader.readAsText(file);
    } else {
      reader.onload = () => onLoad((reader.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    }
  };

  const isACP = config.model.provider === "acp";

  const configRef = useRef(config);
  configRef.current = config;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: () => ({ config: configRef.current }),
      }),
    [],
  );

  const sdkChat = useChat({ transport });
  const acpChat = useACPChat();

  const messages = isACP ? acpChat.messages : sdkChat.messages;
  const status = isACP ? acpChat.status : sdkChat.status;
  const stop = isACP ? acpChat.stop : sdkChat.stop;
  const chatError = isACP ? null : sdkChat.error;
  const clearMessages = () => { sdkChat.setMessages([]); sdkChat.clearError?.(); };

  const sendMessage = useCallback((opts: { text: string }) => {
    setSidebarCollapsed(true);
    if (isACP) {
      acpChat.sendMessage({
        text: opts.text,
        bin: config.model.bin ?? config.model.model,
      });
    } else {
      sdkChat.clearError?.();
      sdkChat.sendMessage(opts).catch((err) => {
        console.error("sendMessage failed:", err);
      });
    }
  }, [isACP, config.model, acpChat, sdkChat]);

  const isRunning = status === "streaming" || status === "submitted";
  // Compute session stats from messages
  const sessionStats = useMemo(() => {
    const fc = { total: 0, search: { count: 0, credits: 0 }, scrape: { count: 0, credits: 0 }, map: { count: 0, credits: 0 }, crawl: { count: 0, credits: 0 }, interact: { count: 0, credits: 0 } };
    let toolCalls = 0;
    let agentTurns = 0;
    let llmCalls = 0;
    let totalChars = 0;
    let workerInputTokens = 0;
    let workerOutputTokens = 0;

    for (const msg of messages) {
      if (msg.role === "assistant") {
        agentTurns++;
        llmCalls++;
      }
      for (const part of msg.parts) {
        if (part.type === "text") {
          totalChars += part.text.length;
        }
        const p = part as Record<string, unknown>;
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          toolCalls++;
          const toolName = (p.toolName ?? (part.type as string).replace("tool-", "")) as string;
          const input = p.input ?? p.args;
          if (input) totalChars += JSON.stringify(input).length;
          const output = (p.output ?? p.result) as Record<string, unknown> | undefined;
          if (output && typeof output === "object") {
            const credits = typeof output.creditsUsed === "number" ? output.creditsUsed as number : 0;
            if (credits > 0) {
              fc.total += credits;
              const bucket = fc[toolName as keyof typeof fc];
              if (bucket && typeof bucket === "object") {
                (bucket as { count: number; credits: number }).count++;
                (bucket as { count: number; credits: number }).credits += credits;
              }
            }
            const contentKeys = ["markdown", "content", "answer", "text", "json", "extract", "data", "output", "web"];
            let contentSize = 0;
            for (const k of contentKeys) {
              if (output[k] !== undefined) contentSize += JSON.stringify(output[k]).length;
            }
            totalChars += contentSize || Math.min(JSON.stringify(output).length, 500);
            if (toolName === "spawnAgents" && Array.isArray(output.results)) {
              for (const wr of output.results as { tokens?: number; inputTokens?: number; outputTokens?: number }[]) {
                workerInputTokens += wr.inputTokens ?? 0;
                workerOutputTokens += wr.outputTokens ?? 0;
              }
            }
          }
        }
      }
    }

    const orchestratorTokens = Math.round(totalChars / 4);
    const orchestratorIn = Math.round(orchestratorTokens * 0.8);
    const orchestratorOut = orchestratorTokens - orchestratorIn;

    llmCalls += toolCalls;

    return { fc, toolCalls, agentTurns, llmCalls, orchestratorIn, orchestratorOut, workerInputTokens, workerOutputTokens };
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

      // Auto-open artifact panel when agent finishes with formatted output
      const hasOutput = messages.some((m) =>
        m.role === "assistant" && m.parts.some((p) => {
          const pp = p as Record<string, unknown>;
          const tn = (pp.toolName ?? (p.type as string).replace("tool-", "")) as string;
          return tn === "formatOutput" && (pp.state === "output-available" || pp.state === "result") && pp.output;
        })
      );
      if (hasOutput) setArtifactOpen(true);
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, messages, config.prompt]);

  // Auto-open artifact panel as soon as formatOutput appears (even while streaming)
  const prevHadArtifact = useRef(false);
  useEffect(() => {
    const hasFormatOutput = messages.some((m) =>
      m.role === "assistant" && m.parts.some((p) => {
        const pp = p as Record<string, unknown>;
        const tn = (pp.toolName ?? (p.type as string).replace("tool-", "")) as string;
        return tn === "formatOutput";
      })
    );
    if (hasFormatOutput && !prevHadArtifact.current) {
      setArtifactOpen(true);
    }
    prevHadArtifact.current = hasFormatOutput;
  }, [messages]);

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
    if (planMode && !planText) {
      // Generate plan first
      setPlanLoading(true);
      fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: config.prompt, config }),
      })
        .then((r) => r.json())
        .then((data) => {
          setPlanText(data.plan);
          setPlanEditText(data.plan);
          setPlanLoading(false);
        })
        .catch(() => {
          setPlanLoading(false);
          alert("Failed to generate plan");
        });
      return;
    }
    // Firecrawl Spark models: use /agent API directly
    if (config.model.provider === "firecrawl") {
      setSparkMode(true);
      setSparkLoading(true);
      setSparkError(null);
      setSparkResult(null);
      setHasSubmitted(true);
      fetch("/api/firecrawl-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: config.prompt,
          model: config.model.model,
          schema: config.schema,
          urls: config.urls,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setSparkError(data.error);
          } else {
            setSparkResult({ data: data.data, status: data.status, creditsUsed: data.creditsUsed });
          }
          setSparkLoading(false);
        })
        .catch((err) => {
          setSparkError(err instanceof Error ? err.message : String(err));
          setSparkLoading(false);
        });
      return;
    }

    // Execute (with or without plan context)
    const promptWithPlan = planText
      ? `Execute this plan:\n\n${planText}\n\nOriginal request: ${config.prompt}`
      : config.prompt;
    setPlanText(null);
    setPlanEditText("");
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(id);
    setHasSubmitted(true);
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: config.prompt.slice(0, 100),
        config,
      }),
    });
    sendMessage({ text: promptWithPlan });
  };

  const mentionSkills = useMemo(() => {
    if (mentionQuery === null || !skills) return [];
    const q = mentionQuery.toLowerCase();
    return skills
      .filter((s) => s.category !== "Export")
      .filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, skills]);

  const currentModel = AVAILABLE_MODELS[config.model.provider]?.find(
    (m) => m.id === config.model.model,
  );
  const currentModelName = currentModel?.name ?? config.model.model;
  const currentModelIcon = currentModel?.icon ?? "openai";

  // First screen: clean input bar like Google/Lovable
  if (!hasSubmitted) {
    return (
      <div className="min-h-screen bg-background-base flex flex-col items-center px-16 relative">
        <div className="absolute top-12 right-20">
          <HeaderLinks />
        </div>
        <div className="flex flex-col items-center gap-12 mb-32 mt-[min(18vh,160px)]">
          <SymbolColored width={56} height={80} />
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
          <div className="px-20 pt-16 pb-8 relative">
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent text-body-large text-accent-black placeholder:text-black-alpha-32 focus:outline-none resize-none"
              placeholder={typingPlaceholder || "What data do you want to extract?"}
              rows={2}
              autoFocus
              value={config.prompt}
              onChange={(e) => {
                const val = e.target.value;
                setConfig({ ...config, prompt: val });
                // @ mention detection
                const pos = e.target.selectionStart ?? val.length;
                const before = val.slice(0, pos);
                const atMatch = before.match(/@([\w-]*)$/);
                if (atMatch) {
                  setMentionQuery(atMatch[1]);
                  setMentionStart(pos - atMatch[0].length);
                } else {
                  setMentionQuery(null);
                }
              }}
              onKeyDown={(e) => {
                if (mentionQuery !== null && mentionSkills.length > 0) {
                  if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const skill = mentionSkills[0];
                    const before = config.prompt.slice(0, mentionStart);
                    const after = config.prompt.slice((textareaRef.current?.selectionStart ?? config.prompt.length));
                    setConfig({ ...config, prompt: before + after, skills: config.skills.includes(skill.name) ? config.skills : [...config.skills, skill.name] });
                    setMentionQuery(null);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey && config.prompt.trim() && mentionQuery === null) {
                  e.preventDefault();
                  onRun();
                }
              }}
            />
            {/* @ mention dropdown */}
            {mentionQuery !== null && mentionSkills.length > 0 && (
              <div
                className="absolute left-20 right-20 top-full mt-2 bg-accent-white rounded-10 border border-border-muted overflow-hidden z-10"
                style={{ boxShadow: "0px 8px 24px -4px rgba(0,0,0,0.08), 0px 2px 8px -2px rgba(0,0,0,0.04)" }}
              >
                {mentionSkills.map((skill) => (
                  <button
                    key={skill.name}
                    type="button"
                    className="w-full text-left px-12 py-8 hover:bg-black-alpha-2 transition-all flex items-center gap-8"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const before = config.prompt.slice(0, mentionStart);
                      const after = config.prompt.slice((textareaRef.current?.selectionStart ?? config.prompt.length));
                      setConfig({ ...config, prompt: before + after, skills: config.skills.includes(skill.name) ? config.skills : [...config.skills, skill.name] });
                      setMentionQuery(null);
                    }}
                  >
                    <SkillsIcon />
                    <div className="min-w-0">
                      <div className="text-label-small text-accent-black">{skill.name}</div>
                      <div className="text-body-small text-black-alpha-40 truncate">{skill.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.json,.md,.xml,.yaml,.yml,.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.pptx,.html"
            className="hidden"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                for (let i = 0; i < files.length; i++) handleFileUpload(files[i]);
              }
              e.target.value = "";
            }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-12 pb-10 pt-4">
            <div className="flex items-center gap-4 relative">
              {/* + button */}
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center w-28 h-28 rounded-8 transition-all",
                    (config.skills.length > 0 || (config.uploads ?? []).length > 0)
                      ? "text-heat-100 hover:bg-heat-8"
                      : "text-black-alpha-32 hover:bg-black-alpha-4 hover:text-black-alpha-48",
                  )}
                  onClick={() => { setShowPlus(!showPlus); setShowModel(false); }}
                >
                  <svg fill="none" height="18" viewBox="0 0 24 24" width="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                {showPlus && (
                  <PlusMenu
                    skills={skills}
                    selectedSkills={config.skills}
                    onSkillsChange={(s) => setConfig({ ...config, skills: s })}
                    onUploadClick={() => fileInputRef.current?.click()}
                    uploads={config.uploads ?? []}
                    onRemoveUpload={(i) =>
                      setConfig({ ...config, uploads: (config.uploads ?? []).filter((_, idx) => idx !== i) })
                    }
                    onClose={() => setShowPlus(false)}
                    planMode={planMode}
                    onTogglePlan={() => { setPlanMode(!planMode); setPlanText(null); setPlanEditText(""); }}
                    schema={config.schema}
                    onSchemaChange={(s) => setConfig({ ...config, schema: s })}
                  />
                )}
              </div>

              {/* Inline indicators for selected items */}
              {((config.uploads ?? []).length > 0 || config.skills.length > 0 || config.schema) && (
                <div className="flex items-center gap-4">
                  {(config.uploads ?? []).map((f, i) => (
                    <span key={`f-${i}`} className="flex items-center gap-2 px-6 py-2 rounded-6 bg-black-alpha-4 text-mono-x-small text-black-alpha-48 max-w-[100px]">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        className="flex-shrink-0 text-black-alpha-24 hover:text-accent-crimson transition-colors"
                        onClick={() => setConfig({ ...config, uploads: (config.uploads ?? []).filter((_, idx) => idx !== i) })}
                      >
                        <svg fill="none" height="8" viewBox="0 0 24 24" width="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                  {config.skills.length > 0 && (
                    <span className="flex items-center gap-4 px-6 py-2 rounded-6 bg-heat-8 text-mono-x-small text-heat-100">
                      <SkillsIcon />
                      {config.skills.length} skill{config.skills.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {config.schema && (
                    <span className="flex items-center gap-2 px-6 py-2 rounded-6 bg-heat-8 text-mono-x-small text-heat-100">
                      {"{}"} Schema
                      <button
                        type="button"
                        className="flex-shrink-0 text-heat-60 hover:text-accent-crimson transition-colors"
                        onClick={() => setConfig({ ...config, schema: undefined })}
                      >
                        <svg fill="none" height="8" viewBox="0 0 24 24" width="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Model + Plan + Submit */}
            <div className="flex items-center gap-4">
              {/* Model button */}
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-6 px-8 py-5 rounded-8 text-label-small text-black-alpha-40 hover:bg-black-alpha-4 transition-all"
                  onClick={() => { setShowModel(!showModel); setShowPlus(false); }}
                >
                  <ProviderModelIcon icon={currentModelIcon} size={14} />
                  <span>{currentModelName}</span>
                </button>
                {showModel && (
                  <ModelDropdown
                    value={config.model}
                    onChange={(model) => setConfig({ ...config, model })}
                    onClose={() => setShowModel(false)}
                    acpAgents={acpAgents}
                    configuredProviders={configuredProviders}
                  />
                )}
              </div>

              <button
                type="button"
                className={cn(
                  "rounded-8 p-8 transition-all",
                  config.prompt.trim() && !planLoading
                    ? "bg-heat-100 hover:bg-[color:var(--heat-90)] text-accent-white active:scale-95"
                    : "bg-black-alpha-8 text-black-alpha-24 cursor-not-allowed",
                )}
                disabled={!config.prompt.trim() || planLoading}
                onClick={onRun}
              >
                {planLoading ? (
                  <div className="w-18 h-18 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <svg fill="none" height="18" viewBox="0 0 20 20" width="18">
                    <path
                      d="M10 16.875V3.125M4.79163 8.33333L9.99994 3.125L15.2083 8.33333"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Plan review */}
        {planText && (
          <div
            className="w-full max-w-640 mt-16 bg-accent-white rounded-12 overflow-hidden"
            style={{
              boxShadow:
                "0px 2px 12px -2px rgba(0,0,0,0.06), 0px 0px 0px 1px rgba(0,0,0,0.06)",
            }}
          >
            <div className="flex items-center justify-between px-16 py-10 border-b border-border-faint">
              <div className="flex items-center gap-6">
                <svg fill="none" height="14" viewBox="0 0 24 24" width="14" className="text-heat-100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
                <span className="text-label-medium text-accent-black">Execution Plan</span>
              </div>
              <button
                type="button"
                className="text-label-small text-black-alpha-40 hover:text-accent-black transition-colors"
                onClick={() => setPlanEditing(!planEditing)}
              >
                {planEditing ? "Preview" : "Edit"}
              </button>
            </div>

            <div className="px-16 py-12">
              {planEditing ? (
                <textarea
                  className="w-full bg-transparent text-body-small text-accent-black font-mono focus:outline-none resize-none min-h-[120px]"
                  value={planEditText}
                  onChange={(e) => setPlanEditText(e.target.value)}
                  rows={Math.max(6, planEditText.split("\n").length)}
                />
              ) : (
                <StreamdownBlock>{planEditText || planText}</StreamdownBlock>
              )}
            </div>

            <div className="flex items-center gap-6 px-16 py-10 border-t border-border-faint">
              <button
                type="button"
                className="px-14 py-6 rounded-8 text-label-small bg-heat-100 text-white hover:bg-[color:var(--heat-90)] transition-all active:scale-95"
                onClick={() => {
                  if (planEditText !== planText) setPlanText(planEditText);
                  onRun();
                }}
              >
                Run plan
              </button>
              <button
                type="button"
                className="px-14 py-6 rounded-8 text-label-small text-black-alpha-48 hover:bg-black-alpha-4 transition-all"
                onClick={() => {
                  setPlanLoading(true);
                  fetch("/api/plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      prompt: `${config.prompt}\n\nPrevious plan (revise and improve):\n${planEditText}`,
                      config,
                    }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      setPlanText(data.plan);
                      setPlanEditText(data.plan);
                      setPlanLoading(false);
                    })
                    .catch(() => setPlanLoading(false));
                }}
                disabled={planLoading}
              >
                {planLoading ? "Regenerating..." : "Regenerate"}
              </button>
              <button
                type="button"
                className="px-14 py-6 rounded-8 text-label-small text-black-alpha-32 hover:text-accent-crimson hover:bg-accent-crimson/5 transition-all ml-auto"
                onClick={() => { setPlanText(null); setPlanEditText(""); }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Example prompts */}
        <div className="w-full max-w-640 mt-20">
          <div className="grid grid-cols-2 gap-8">
            {[
              "Get AAPL financials from finance.yahoo.com/quote/AAPL — income statement, balance sheet, and cash flow",
              "Extract the top 20 products from amazon.com/s?k=mechanical+keyboards with prices and ratings",
              "Search for the 5 best AI code editors in 2025, scrape each homepage, and compare their features",
              "Scrape news.ycombinator.com front page, then scrape the top 5 article links in parallel",
              "Go to reddit.com/r/selfhosted/top?t=month, interact to load all posts, extract titles and scores",
              "Research Anthropic, OpenAI, and Google DeepMind — scrape each site in parallel, extract team size, funding, and key products",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="text-left px-14 py-10 rounded-10 border border-border-faint bg-accent-white hover:border-heat-40 hover:bg-heat-4 transition-all group"
                onClick={() => {
                  const updated = { ...config, prompt };
                  setConfig(updated);
                  // Run directly with the updated config to avoid stale state
                  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                  setConversationId(id);
                  setHasSubmitted(true);
                  fetch("/api/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, title: prompt.slice(0, 100), config: updated }),
                  });
                  sendMessage({ text: prompt });
                }}
              >
                <span className="text-body-medium text-black-alpha-48 group-hover:text-accent-black transition-colors line-clamp-2">
                  {prompt}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent conversations */}
        <div className="w-full max-w-640 pb-60">
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
            setConfig(defaultConfig);
            setConversationId(null);
            setSuggestions([]);
            setSparkMode(false);
            setSparkResult(null);
            setSparkError(null);
            setSparkLoading(false);
            clearMessages();
            stop();
          }}
        >
          <SymbolColored width={22} height={32} />
        </button>
        <div className="ml-auto flex items-center gap-6">
          {isRunning && (
            <button
              type="button"
              className="px-12 py-6 rounded-8 text-label-small bg-black-alpha-4 text-accent-black hover:bg-black-alpha-8 transition-all"
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
            clearMessages();
            stop();
          }}
        />

      <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className={cn("mx-auto px-20 py-24 transition-all duration-200", sidebarCollapsed && !artifactOpen ? "max-w-900" : "max-w-700")}>
        {/* Query display */}
        <div className="mb-20">
          <div className="text-title-h4 text-accent-black">
            {config.prompt}
          </div>
        </div>

        {/* Firecrawl Spark results */}
        {sparkMode ? (
          <div className="mt-8">
            {sparkLoading && (
              <div className="my-12 rounded-10 border border-heat-40 shadow-sm overflow-hidden">
                <div className="flex items-center gap-8 px-14 py-10">
                  <ProviderModelIcon icon="firecrawl" size={16} />
                  <span className="text-label-small text-accent-black">
                    {config.model.model === "spark-1-pro" ? "Spark 1 Pro" : "Spark 1 Mini"}
                  </span>
                  <span className="text-mono-x-small text-heat-100 bg-heat-8 px-4 py-1 rounded-4 animate-pulse">processing</span>
                </div>
                <div className="border-t border-border-faint bg-background-lighter p-14">
                  <div className="flex items-center gap-10">
                    <div className="w-16 h-16 border-2 border-heat-100 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="text-body-small text-black-alpha-48">Searching, navigating, and extracting data...</span>
                  </div>
                  <div className="text-mono-x-small text-black-alpha-24 mt-6 ml-26">This may take a few minutes for complex queries</div>
                </div>
              </div>
            )}
            {sparkError && (
              <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
                <div className="flex items-center gap-8 px-14 py-10">
                  <ProviderModelIcon icon="firecrawl" size={16} />
                  <span className="text-label-small text-accent-black">
                    {config.model.model === "spark-1-pro" ? "Spark 1 Pro" : "Spark 1 Mini"}
                  </span>
                  <span className="text-mono-x-small text-accent-crimson bg-accent-crimson/8 px-4 py-1 rounded-4">failed</span>
                </div>
                <div className="border-t border-border-faint bg-background-lighter p-14">
                  <div className="text-body-small text-accent-black">{sparkError}</div>
                  <button
                    type="button"
                    className="mt-10 px-12 py-6 rounded-8 text-label-small text-black-alpha-48 hover:text-accent-black bg-black-alpha-4 hover:bg-black-alpha-8 transition-all"
                    onClick={() => { setHasSubmitted(false); setSparkMode(false); setSparkError(null); }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
            {sparkResult && (
              <div className="my-12 rounded-10 border border-border-faint overflow-hidden">
                <div className="flex items-center gap-8 px-14 py-10">
                  <ProviderModelIcon icon="firecrawl" size={16} />
                  <span className="text-label-small text-accent-black">
                    {config.model.model === "spark-1-pro" ? "Spark 1 Pro" : "Spark 1 Mini"}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
                    onClick={() => {
                      const text = typeof sparkResult.data === "string"
                        ? sparkResult.data
                        : JSON.stringify(sparkResult.data, null, 2);
                      navigator.clipboard.writeText(text);
                    }}
                  >
                    <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-4 text-mono-x-small text-black-alpha-32 hover:text-accent-black transition-colors"
                    onClick={() => {
                      const text = typeof sparkResult.data === "string"
                        ? sparkResult.data
                        : JSON.stringify(sparkResult.data, null, 2);
                      const blob = new Blob([text], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "output.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download
                  </button>
                </div>
                <div className="border-t border-border-faint bg-background-lighter max-h-500 overflow-auto no-scrollbar">
                  <JsonViewer data={typeof sparkResult.data === "string" ? sparkResult.data : JSON.stringify(sparkResult.data, null, 2)} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
        {/* Activity feed */}
        <PlanVisualization messages={messages} isRunning={isRunning} preloadedSkills={config.skills.length > 0 ? config.skills : undefined} onArtifactClick={() => setArtifactOpen(true)} />

        {/* Bottom section */}
        {messages.length > 0 && (
          <div className="mt-20 pt-16 border-t border-border-faint">
            {/* Error display */}
            {chatError && (
              <div className="mb-10 px-14 py-10 rounded-10 border border-accent-crimson/20 bg-accent-crimson/5 text-body-small text-accent-black">
                <span className="text-accent-crimson text-label-small">Error: </span>
                {chatError.message || "Something went wrong"}
              </div>
            )}

            {/* Follow-up input */}
            <div
              className={cn("bg-accent-white rounded-12 overflow-hidden transition-opacity", isRunning && "opacity-50 pointer-events-none")}
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
                  disabled={isRunning}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followUp.trim() && !isRunning) {
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

            {/* Suggestions */}
            {!isRunning && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-6 mt-10">
                {suggestions.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="px-12 py-6 rounded-8 text-body-small text-black-alpha-40 bg-black-alpha-2 hover:bg-black-alpha-4 hover:text-accent-black transition-all text-left"
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

          </div>
        )}

          </>
        )}

        {/* Session stats scoreboard */}
        {messages.length > 0 && (
          <div className="mt-16 mb-8">
            <div className="flex items-center justify-end gap-x-12 gap-y-4 flex-wrap">
              <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                <ProviderModelIcon icon={currentModelIcon} size={12} />
                {currentModelName}
              </div>
              <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                {sessionStats.agentTurns} turn{sessionStats.agentTurns !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4zM8 14v.5A3.5 3.5 0 004.5 18v0a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v0A3.5 3.5 0 0016 14.5V14" /></svg>
                {sessionStats.llmCalls} LLM call{sessionStats.llmCalls !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
                {(() => {
                  const fmt = (n: number) => n > 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
                  const totalIn = sessionStats.orchestratorIn + sessionStats.workerInputTokens;
                  const totalOut = sessionStats.orchestratorOut + sessionStats.workerOutputTokens;
                  return `~${fmt(totalIn)} in · ${fmt(totalOut)} out`;
                })()}
              </div>
              {sessionStats.fc.total > 0 && (
                <div className="flex items-center gap-4 text-mono-x-small text-black-alpha-32">
                  <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  {sessionStats.fc.total} credits
                </div>
              )}
            </div>
            {sessionStats.fc.total > 0 && (
              <div className="flex items-center justify-end gap-x-8 gap-y-4 flex-wrap mt-4">
                {(["search", "scrape", "map", "crawl", "interact"] as const).map((tool) => {
                  const b = sessionStats.fc[tool];
                  if (b.count === 0) return null;
                  return (
                    <span key={tool} className="text-mono-x-small text-black-alpha-24">
                      {b.count} {tool}{b.count !== 1 && tool !== "search" ? "s" : b.count !== 1 ? "es" : ""} ({b.credits}cr)
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Artifact panel -- right side, auto-opens when output is ready */}
      {artifactOpen && (
        <ArtifactPanel
          messages={messages}
          isRunning={isRunning}
          prompt={config.prompt}
          schema={config.schema}
          urls={config.urls}
          onRequestFormat={(format) => {
            if (format === "Workflow") {
              sendMessage({ text: `Load the "export-workflow" skill. Review all tool calls from this session and generate the full skill package: SKILL.md (agent instructions with self-healing), workflow.mjs (deterministic script with structured logging), and schema.json (expected output shape). Write all three to /data/ and return a summary.` });
              return;
            }
            const skillMap: Record<string, string> = { JSON: "export-json", CSV: "export-csv", Markdown: "export-report" };
            const skill = skillMap[format] ?? "export-json";
            sendMessage({ text: `Load the "${skill}" skill and then format all the collected data as ${format}. Follow the skill instructions. Stream the output inline.` });
          }}
          onClose={() => setArtifactOpen(false)}
        />
      )}

      </div>


    </div>
  );
}
