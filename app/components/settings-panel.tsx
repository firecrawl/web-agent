"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentConfig, ModelConfig } from "@/lib/types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@/lib/config/models";
import ProviderModelIcon from "./provider-icon";
import { cn } from "@/utils/cn";

type KeyStatus = {
  configured: boolean;
  masked: string;
  source: string;
};

type ConfigResponse = {
  keys: Record<string, KeyStatus>;
  hosted: boolean;
  writable: boolean;
};

function GearIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const PROVIDERS = [
  {
    id: "firecrawl",
    label: "Firecrawl",
    icon: "openai",
    envVar: "FIRECRAWL_API_KEY",
    placeholder: "fc-...",
    description: "Required. Powers search, scrape, and interact tools.",
    required: true,
    hasModels: false,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    icon: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    placeholder: "sk-ant-...",
    description: "Claude models for orchestration, planning, and export.",
    required: false,
    hasModels: true,
    provider: "anthropic" as Provider,
  },
  {
    id: "openai",
    label: "OpenAI",
    icon: "openai",
    envVar: "OPENAI_API_KEY",
    placeholder: "sk-...",
    description: "GPT and o-series models.",
    required: false,
    hasModels: true,
    provider: "openai" as Provider,
  },
  {
    id: "google",
    label: "Google AI",
    icon: "gemini",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    placeholder: "AI...",
    description: "Gemini models.",
    required: false,
    hasModels: true,
    provider: "google" as Provider,
  },
  {
    id: "gateway",
    label: "AI Gateway",
    icon: "openai",
    envVar: "AI_GATEWAY_API_KEY",
    placeholder: "vck_...",
    description: "Vercel AI Gateway. Access multiple providers through a single key.",
    required: false,
    hasModels: true,
    provider: "gateway" as Provider,
  },
];

const OPERATIONS = [
  { id: "search", label: "Search" },
  { id: "scrape", label: "Scrape" },
  { id: "interact", label: "Interact" },
  { id: "plan", label: "Plan" },
  { id: "export", label: "Export" },
];

function StatusDot({ configured, required }: { configured: boolean; required?: boolean }) {
  return (
    <div className={cn(
      "w-7 h-7 rounded-full flex-shrink-0",
      configured ? "bg-accent-forest" : required ? "bg-heat-100" : "bg-black-alpha-12"
    )} />
  );
}

export default function SettingsPanel({
  config,
  onChange,
}: {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("firecrawl");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
  const [hosted, setHosted] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data: ConfigResponse = await res.json();
        setKeyStatuses(data.keys);
        setHosted(data.hosted);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (open) fetchKeys();
  }, [open, fetchKeys]);

  const saveKey = async (id: string) => {
    const value = keyDrafts[id]?.trim();
    if (!value) return;

    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: { [id]: value } }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeyStatuses(data.keys);
        setKeyDrafts((prev) => ({ ...prev, [id]: "" }));
        setSaveMsg(hosted ? "Saved for this session" : "Saved to .env.local");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg(data.error || "Failed to save");
      }
    } catch {
      setSaveMsg("Network error");
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: { [id]: "" } }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeyStatuses(data.keys);
        setSaveMsg("Key removed");
        setTimeout(() => setSaveMsg(""), 3000);
      }
    } catch { /* noop */ }
    finally { setSaving(false); }
  };

  const activeProvider = PROVIDERS.find((p) => p.id === activeSection);
  const activeStatus = keyStatuses[activeSection];
  const currentModel = AVAILABLE_MODELS[config.model.provider]?.find(m => m.id === config.model.model);

  return (
    <>
      <button
        type="button"
        className="p-8 rounded-8 text-black-alpha-40 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
        onClick={() => setOpen(true)}
      >
        <GearIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div
            className="relative bg-accent-white rounded-20 border border-border-muted overflow-hidden flex w-[680px] max-h-[520px]"
            style={{ boxShadow: "0px 24px 64px -12px rgba(0,0,0,0.14), 0px 8px 24px -4px rgba(0,0,0,0.06)" }}
          >
            {/* Left sidebar */}
            <div className="w-[200px] border-r border-border-faint bg-background-base flex flex-col">
              <div className="px-16 py-14 border-b border-border-faint">
                <div className="text-label-large text-accent-black">Settings</div>
              </div>
              <nav className="flex-1 py-6 px-8 flex flex-col gap-1 overflow-y-auto">
                {PROVIDERS.map((p) => {
                  const status = keyStatuses[p.id];
                  const isActive = activeSection === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-8 px-10 py-8 rounded-10 text-left transition-all w-full",
                        isActive
                          ? "bg-accent-white text-accent-black shadow-sm"
                          : "text-black-alpha-56 hover:text-accent-black hover:bg-black-alpha-4"
                      )}
                      onClick={() => { setActiveSection(p.id); setSaveMsg(""); }}
                    >
                      <ProviderModelIcon icon={p.icon} size={16} />
                      <span className="text-label-small flex-1">{p.label}</span>
                      <StatusDot configured={status?.configured ?? false} required={p.required} />
                    </button>
                  );
                })}

                <div className="h-px bg-border-faint my-6 mx-4" />

                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-8 px-10 py-8 rounded-10 text-left transition-all w-full",
                    activeSection === "general"
                      ? "bg-accent-white text-accent-black shadow-sm"
                      : "text-black-alpha-56 hover:text-accent-black hover:bg-black-alpha-4"
                  )}
                  onClick={() => { setActiveSection("general"); setSaveMsg(""); }}
                >
                  <svg fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-label-small flex-1">General</span>
                </button>
              </nav>

              {/* Sidebar footer */}
              <div className="px-12 py-10 border-t border-border-faint">
                <div className="text-mono-x-small text-black-alpha-24">
                  {hosted ? "Hosted mode" : ".env.local"}
                </div>
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Close button */}
              <button
                type="button"
                className="absolute top-12 right-12 p-4 rounded-8 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
                onClick={() => setOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              {/* Provider detail view */}
              {activeProvider && (
                <div className="flex-1 overflow-y-auto p-20 flex flex-col gap-20">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-10 mb-6">
                      <ProviderModelIcon icon={activeProvider.icon} size={20} />
                      <span className="text-title-medium text-accent-black">{activeProvider.label}</span>
                      {activeStatus?.configured && (
                        <span className="text-mono-x-small text-accent-forest bg-accent-forest/8 px-6 py-2 rounded-6">Connected</span>
                      )}
                      {!activeStatus?.configured && activeProvider.required && (
                        <span className="text-mono-x-small text-heat-100 bg-heat-100/8 px-6 py-2 rounded-6">Required</span>
                      )}
                    </div>
                    <p className="text-body-small text-black-alpha-48">{activeProvider.description}</p>
                  </div>

                  {/* API Key section */}
                  <div>
                    <div className="text-label-small text-black-alpha-48 mb-8">API Key</div>

                    {activeStatus?.configured ? (
                      <div className="flex items-center gap-8">
                        <div className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 flex items-center gap-8">
                          <span className="text-mono-small text-black-alpha-40 flex-1">{activeStatus.masked}</span>
                          <span className="text-mono-x-small text-black-alpha-20">{activeStatus.source}</span>
                        </div>
                        <button
                          type="button"
                          className="px-10 py-8 rounded-10 text-label-small text-black-alpha-40 hover:text-heat-100 hover:bg-heat-100/6 transition-all border border-transparent hover:border-heat-100/20"
                          onClick={() => removeKey(activeProvider.id)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-8">
                        <input
                          type="password"
                          className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none"
                          placeholder={activeProvider.placeholder}
                          value={keyDrafts[activeProvider.id] ?? ""}
                          onChange={(e) =>
                            setKeyDrafts((prev) => ({ ...prev, [activeProvider.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveKey(activeProvider.id);
                          }}
                        />
                        <button
                          type="button"
                          disabled={!(keyDrafts[activeProvider.id]?.trim()) || saving}
                          className={cn(
                            "px-12 py-8 rounded-10 text-label-small transition-all",
                            keyDrafts[activeProvider.id]?.trim()
                              ? "bg-accent-black text-accent-white hover:bg-black-alpha-80"
                              : "bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed"
                          )}
                          onClick={() => saveKey(activeProvider.id)}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    )}

                    {/* Replace existing key */}
                    {activeStatus?.configured && (
                      <div className="mt-8">
                        <div className="text-mono-x-small text-black-alpha-24 mb-4">Replace with new key</div>
                        <div className="flex items-center gap-8">
                          <input
                            type="password"
                            className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none"
                            placeholder={activeProvider.placeholder}
                            value={keyDrafts[activeProvider.id] ?? ""}
                            onChange={(e) =>
                              setKeyDrafts((prev) => ({ ...prev, [activeProvider.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveKey(activeProvider.id);
                            }}
                          />
                          <button
                            type="button"
                            disabled={!(keyDrafts[activeProvider.id]?.trim()) || saving}
                            className={cn(
                              "px-12 py-8 rounded-10 text-label-small transition-all",
                              keyDrafts[activeProvider.id]?.trim()
                                ? "bg-accent-black text-accent-white hover:bg-black-alpha-80"
                                : "bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed"
                            )}
                            onClick={() => saveKey(activeProvider.id)}
                          >
                            {saving ? "Saving..." : "Update"}
                          </button>
                        </div>
                      </div>
                    )}

                    {saveMsg && (
                      <div className={cn(
                        "mt-8 text-mono-x-small",
                        saveMsg.includes("Saved") || saveMsg.includes("removed") ? "text-accent-forest" : "text-heat-100"
                      )}>
                        {saveMsg}
                      </div>
                    )}

                    <div className="mt-8 text-mono-x-small text-black-alpha-20">
                      {hosted
                        ? "Keys are stored in memory for this session. Set environment variables in your hosting provider for persistence."
                        : `Stored securely in .env.local as ${activeProvider.envVar}`}
                    </div>
                  </div>

                  {/* Available models */}
                  {activeProvider.hasModels && activeProvider.provider && (
                    <div>
                      <div className="text-label-small text-black-alpha-48 mb-8">Available Models</div>
                      <div className="flex flex-col gap-2">
                        {(AVAILABLE_MODELS[activeProvider.provider] ?? []).map((m) => (
                          <div key={m.id} className="flex items-center gap-8 px-10 py-6 rounded-8 bg-background-base">
                            <ProviderModelIcon icon={m.icon} size={14} />
                            <span className="text-body-small text-accent-black">{m.name}</span>
                            <span className="text-mono-x-small text-black-alpha-20 ml-auto">{m.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* General settings view */}
              {activeSection === "general" && (
                <div className="flex-1 overflow-y-auto p-20 flex flex-col gap-20">
                  <div>
                    <div className="text-title-medium text-accent-black mb-4">General</div>
                    <p className="text-body-small text-black-alpha-48">Orchestrator, sub-agent models, and tool configuration.</p>
                  </div>

                  {/* Orchestrator model */}
                  <div>
                    <div className="text-label-small text-black-alpha-48 mb-8">Orchestrator Model</div>
                    <div className="flex gap-6">
                      <select
                        className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                        value={config.model.provider}
                        onChange={(e) => {
                          const provider = e.target.value as ModelConfig["provider"];
                          const models = AVAILABLE_MODELS[provider] ?? [];
                          onChange({ ...config, model: { ...config.model, provider, model: models[0]?.id ?? "" } });
                        }}
                      >
                        {(Object.keys(PROVIDER_META).filter(k => k !== "acp") as Provider[]).map((p) => (
                          <option key={p} value={p}>{PROVIDER_META[p].name}</option>
                        ))}
                      </select>
                      <select
                        className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                        value={config.model.model}
                        onChange={(e) => onChange({ ...config, model: { ...config.model, model: e.target.value } })}
                      >
                        {(AVAILABLE_MODELS[config.model.provider] ?? []).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sub-agent model */}
                  <div>
                    <div className="flex items-center gap-6 mb-8">
                      <span className="text-label-small text-black-alpha-48">Sub-agent Model</span>
                      {!config.subAgentModel && (
                        <span className="text-mono-x-small text-black-alpha-20">(same as orchestrator)</span>
                      )}
                    </div>
                    <div className="flex gap-6">
                      <select
                        className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                        value={config.subAgentModel?.provider ?? ""}
                        onChange={(e) => {
                          if (!e.target.value) {
                            onChange({ ...config, subAgentModel: undefined });
                            return;
                          }
                          const provider = e.target.value as ModelConfig["provider"];
                          const models = AVAILABLE_MODELS[provider] ?? [];
                          onChange({
                            ...config,
                            subAgentModel: {
                              provider,
                              model: config.subAgentModel?.model ?? models[0]?.id ?? "",
                            },
                          });
                        }}
                      >
                        <option value="">Same as orchestrator</option>
                        {(Object.keys(PROVIDER_META).filter(k => k !== "acp") as Provider[]).map((p) => (
                          <option key={p} value={p}>{PROVIDER_META[p].name}</option>
                        ))}
                      </select>
                      {config.subAgentModel && (
                        <select
                          className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                          value={config.subAgentModel.model}
                          onChange={(e) =>
                            onChange({ ...config, subAgentModel: { ...config.subAgentModel!, model: e.target.value } })
                          }
                        >
                          {(AVAILABLE_MODELS[config.subAgentModel.provider] ?? []).map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Max steps */}
                  <div>
                    <div className="text-label-small text-black-alpha-48 mb-8">Max Steps</div>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="w-100 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small focus:border-heat-100 focus:outline-none"
                      value={config.maxSteps ?? 20}
                      onChange={(e) => onChange({ ...config, maxSteps: parseInt(e.target.value) || 20 })}
                    />
                  </div>

                  {/* Per-operation overrides */}
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-6 text-label-small text-black-alpha-40 hover:text-accent-black transition-colors"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <svg fill="none" height="10" viewBox="0 0 24 24" width="10" className={cn("transition-transform", showAdvanced && "rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      Per-operation model overrides
                    </button>

                    {showAdvanced && (
                      <div className="mt-10 flex flex-col gap-10 pl-16 border-l-2 border-border-faint">
                        {OPERATIONS.map((op) => {
                          const override = config.operationModels?.[op.id];
                          return (
                            <div key={op.id}>
                              <div className="flex items-center gap-6 mb-4">
                                <span className="text-label-small text-black-alpha-48">{op.label}</span>
                                {!override && <span className="text-mono-x-small text-black-alpha-20">(default)</span>}
                              </div>
                              <div className="flex gap-4">
                                <select
                                  className="flex-1 bg-background-base border border-black-alpha-8 rounded-8 px-8 py-6 text-mono-x-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                                  value={override?.provider ?? ""}
                                  onChange={(e) => {
                                    const opModels = { ...(config.operationModels ?? {}) };
                                    if (!e.target.value) {
                                      delete opModels[op.id];
                                    } else {
                                      const provider = e.target.value as ModelConfig["provider"];
                                      const models = AVAILABLE_MODELS[provider] ?? [];
                                      opModels[op.id] = { provider, model: models[0]?.id ?? "" };
                                    }
                                    onChange({ ...config, operationModels: Object.keys(opModels).length ? opModels : undefined });
                                  }}
                                >
                                  <option value="">Default</option>
                                  {(Object.keys(PROVIDER_META).filter(k => k !== "acp") as Provider[]).map((p) => (
                                    <option key={p} value={p}>{PROVIDER_META[p].name}</option>
                                  ))}
                                </select>
                                {override && (
                                  <select
                                    className="flex-1 bg-background-base border border-black-alpha-8 rounded-8 px-8 py-6 text-mono-x-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                                    value={override.model}
                                    onChange={(e) => {
                                      const opModels = { ...(config.operationModels ?? {}) };
                                      opModels[op.id] = { ...override, model: e.target.value };
                                      onChange({ ...config, operationModels: opModels });
                                    }}
                                  >
                                    {(AVAILABLE_MODELS[override.provider] ?? []).map((m) => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-20 py-12 border-t border-border-faint bg-background-base flex items-center gap-8">
                <ProviderModelIcon icon={currentModel?.icon ?? "openai"} size={14} />
                <span className="text-body-small text-black-alpha-40">{currentModel?.name ?? config.model.model}</span>
                <span className="text-black-alpha-12">|</span>
                <span className="text-body-small text-black-alpha-40">{config.maxSteps ?? 20} steps</span>
                {config.subAgentModel && (
                  <>
                    <span className="text-black-alpha-12">|</span>
                    <span className="text-body-small text-black-alpha-40">
                      Sub: {AVAILABLE_MODELS[config.subAgentModel.provider]?.find(m => m.id === config.subAgentModel!.model)?.name ?? config.subAgentModel.model}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
