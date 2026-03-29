"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentConfig, ModelConfig } from "@/lib/types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@/lib/config/models";
import ProviderModelIcon from "./provider-icon";
import { cn } from "@/utils/cn";

type KeyStatus = { configured: boolean; masked: string; source: string };
type ConfigResponse = { keys: Record<string, KeyStatus>; hosted: boolean; writable: boolean };
type SkillInfo = { name: string; description: string; category: string; resources: string[] };

function GearIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const PROVIDERS = [
  { id: "firecrawl", label: "Firecrawl", icon: "firecrawl", envVar: "FIRECRAWL_API_KEY", placeholder: "fc-...", description: "Required. Powers search, scrape, and interact tools.", required: true, hasModels: false },
  { id: "anthropic", label: "Anthropic", icon: "anthropic", envVar: "ANTHROPIC_API_KEY", placeholder: "sk-ant-...", description: "Claude models for orchestration, planning, and export.", required: false, hasModels: true, provider: "anthropic" as Provider },
  { id: "openai", label: "OpenAI", icon: "openai", envVar: "OPENAI_API_KEY", placeholder: "sk-...", description: "GPT and o-series models.", required: false, hasModels: true, provider: "openai" as Provider },
  { id: "google", label: "Google AI", icon: "gemini", envVar: "GOOGLE_GENERATIVE_AI_API_KEY", placeholder: "AI...", description: "Gemini models.", required: false, hasModels: true, provider: "google" as Provider },
  { id: "gateway", label: "AI Gateway", icon: "vercel", envVar: "AI_GATEWAY_API_KEY", placeholder: "vck_...", description: "Vercel AI Gateway. Access multiple providers through a single key.", required: false, hasModels: true, provider: "gateway" as Provider },
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
      "w-8 h-8 rounded-full flex-shrink-0",
      configured ? "bg-accent-forest" : required ? "bg-heat-100" : "bg-black-alpha-12"
    )} />
  );
}

function SidebarSection({ label }: { label: string }) {
  return <div className="text-mono-x-small text-black-alpha-32 uppercase tracking-wider px-16 pt-16 pb-4">{label}</div>;
}

function SidebarItem({ active, icon, label, right, onClick }: { active: boolean; icon: React.ReactNode; label: string; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-10 px-16 py-10 text-left transition-all w-full",
        active ? "bg-accent-white text-accent-black" : "text-black-alpha-56 hover:text-accent-black hover:bg-white/50"
      )}
      onClick={onClick}
    >
      <span className="flex-shrink-0 w-20 flex items-center justify-center">{icon}</span>
      <span className="text-label-small flex-1 truncate">{label}</span>
      {right}
    </button>
  );
}

function ProviderView({
  provider,
  status,
  keyDraft,
  onDraftChange,
  onSave,
  onRemove,
  saving,
  saveMsg,
  hosted,
}: {
  provider: typeof PROVIDERS[number];
  status?: KeyStatus;
  keyDraft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
  saving: boolean;
  saveMsg: string;
  hosted: boolean;
}) {
  const configured = status?.configured ?? false;

  return (
    <div className="flex flex-col gap-28">
      <div>
        <div className="flex items-center gap-12 mb-8">
          <ProviderModelIcon icon={provider.icon} size={24} />
          <h2 className="text-title-h5 text-accent-black">{provider.label}</h2>
          {configured && <span className="text-label-x-small text-accent-forest bg-accent-forest/8 px-8 py-3 rounded-8">API key detected</span>}
          {!configured && provider.required && <span className="text-label-x-small text-heat-100 bg-heat-100/8 px-8 py-3 rounded-8">Required</span>}
          {!configured && !provider.required && <span className="text-label-x-small text-black-alpha-32 bg-black-alpha-4 px-8 py-3 rounded-8">Not configured</span>}
        </div>
        <p className="text-body-medium text-black-alpha-48">{provider.description}</p>
      </div>

      <div>
        <div className="text-label-medium text-accent-black mb-10">API Key</div>
        {configured ? (
          <>
            <div className="flex items-center gap-10">
              <div className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 flex items-center gap-10">
                <span className="text-mono-medium text-black-alpha-40 flex-1">{status!.masked}</span>
                <span className="text-mono-x-small text-black-alpha-20">{status!.source}</span>
              </div>
              <button
                type="button"
                className="px-14 py-10 rounded-12 text-label-small text-black-alpha-40 hover:text-heat-100 hover:bg-heat-100/6 transition-all border border-black-alpha-8 hover:border-heat-100/20"
                onClick={onRemove}
                disabled={saving}
              >
                Remove
              </button>
            </div>
            <div className="mt-16">
              <div className="text-label-small text-black-alpha-32 mb-6">Replace with new key</div>
              <div className="flex items-center gap-10">
                <input
                  type="password"
                  className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none"
                  placeholder={provider.placeholder}
                  value={keyDraft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
                />
                <button
                  type="button"
                  disabled={!keyDraft.trim() || saving}
                  className={cn(
                    "px-16 py-10 rounded-12 text-label-small transition-all",
                    keyDraft.trim() ? "bg-accent-black text-accent-white hover:bg-black-alpha-80" : "bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed"
                  )}
                  onClick={onSave}
                >
                  {saving ? "Saving..." : "Update"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-10">
            <input
              type="password"
              className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none"
              placeholder={provider.placeholder}
              value={keyDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
            />
            <button
              type="button"
              disabled={!keyDraft.trim() || saving}
              className={cn(
                "px-16 py-10 rounded-12 text-label-small transition-all",
                keyDraft.trim() ? "bg-accent-black text-accent-white hover:bg-black-alpha-80" : "bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed"
              )}
              onClick={onSave}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {saveMsg && (
          <div className={cn("mt-10 text-label-small", saveMsg.includes("Saved") || saveMsg.includes("removed") ? "text-accent-forest" : "text-heat-100")}>{saveMsg}</div>
        )}

        <div className="mt-10 text-mono-x-small text-black-alpha-20">
          {hosted ? "Keys stored in memory for this session. Set environment variables in your hosting provider for persistence." : `Stored securely in .env.local as ${provider.envVar}`}
        </div>
      </div>

      {provider.hasModels && provider.provider && (
        <div>
          <div className="text-label-medium text-accent-black mb-10">Available Models</div>
          <div className="flex flex-col gap-3">
            {(AVAILABLE_MODELS[provider.provider] ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-10 px-14 py-10 rounded-10 bg-background-base border border-black-alpha-4">
                <ProviderModelIcon icon={m.icon} size={16} />
                <span className="text-body-medium text-accent-black flex-1">{m.name}</span>
                <span className="text-mono-x-small text-black-alpha-20">{m.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillView({
  skill,
  instructions,
  onInstructionsChange,
}: {
  skill: SkillInfo;
  instructions: string;
  onInstructionsChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-28">
      <div>
        <div className="flex items-center gap-12 mb-8">
          <div className="w-24 h-24 rounded-8 bg-black-alpha-4 flex items-center justify-center text-black-alpha-40">
            <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
              <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
            </svg>
          </div>
          <h2 className="text-title-h5 text-accent-black">{skill.name}</h2>
          <span className="text-mono-x-small text-black-alpha-20 bg-black-alpha-4 px-8 py-3 rounded-6">{skill.category}</span>
        </div>
        <p className="text-body-medium text-black-alpha-48">{skill.description}</p>
      </div>

      <div>
        <div className="text-label-medium text-accent-black mb-6">Custom Instructions</div>
        <p className="text-body-small text-black-alpha-32 mb-10">
          Additional instructions injected when this skill is loaded by the orchestrator or any sub-agent.
        </p>
        <textarea
          className="w-full bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none resize-none min-h-[160px]"
          placeholder="e.g. Always include pricing in USD. Focus on enterprise tiers. Output as a comparison table."
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          rows={6}
        />
      </div>

      {skill.resources.length > 0 && (
        <div>
          <div className="text-label-medium text-accent-black mb-10">Resources</div>
          <div className="flex flex-wrap gap-6">
            {skill.resources.map((r) => (
              <span key={r} className="text-mono-x-small text-black-alpha-40 bg-background-base border border-black-alpha-4 px-10 py-4 rounded-8">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralView({
  config,
  onChange,
  keyStatuses,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  keyStatuses: Record<string, { configured: boolean }>;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const availableProviders = (Object.keys(PROVIDER_META).filter(k => k !== "acp") as Provider[]).filter(
    (p) => {
      const hasAny = Object.values(keyStatuses).some(s => s.configured);
      return !hasAny || keyStatuses[p]?.configured;
    }
  );

  return (
    <div className="flex flex-col gap-28">
      <div>
        <h2 className="text-title-h5 text-accent-black mb-4">General</h2>
        <p className="text-body-medium text-black-alpha-48">Orchestrator and sub-agent model configuration.</p>
      </div>

      <div>
        <div className="text-label-medium text-accent-black mb-10">Orchestrator Model</div>
        <div className="flex gap-8">
          <select
            className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
            value={config.model.provider}
            onChange={(e) => {
              const provider = e.target.value as ModelConfig["provider"];
              const models = AVAILABLE_MODELS[provider] ?? [];
              onChange({ ...config, model: { ...config.model, provider, model: models[0]?.id ?? "" } });
            }}
          >
            {availableProviders.map((p) => (
              <option key={p} value={p}>{PROVIDER_META[p].name}</option>
            ))}
          </select>
          <select
            className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
            value={config.model.model}
            onChange={(e) => onChange({ ...config, model: { ...config.model, model: e.target.value } })}
          >
            {(AVAILABLE_MODELS[config.model.provider] ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-8 mb-10">
          <span className="text-label-medium text-accent-black">Sub-agent Model</span>
          {!config.subAgentModel && <span className="text-mono-x-small text-black-alpha-20">(same as orchestrator)</span>}
        </div>
        <div className="flex gap-8">
          <select
            className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
            value={config.subAgentModel?.provider ?? ""}
            onChange={(e) => {
              if (!e.target.value) { onChange({ ...config, subAgentModel: undefined }); return; }
              const provider = e.target.value as ModelConfig["provider"];
              const models = AVAILABLE_MODELS[provider] ?? [];
              onChange({ ...config, subAgentModel: { provider, model: config.subAgentModel?.model ?? models[0]?.id ?? "" } });
            }}
          >
            <option value="">Same as orchestrator</option>
            {availableProviders.map((p) => (
              <option key={p} value={p}>{PROVIDER_META[p].name}</option>
            ))}
          </select>
          {config.subAgentModel && (
            <select
              className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
              value={config.subAgentModel.model}
              onChange={(e) => onChange({ ...config, subAgentModel: { ...config.subAgentModel!, model: e.target.value } })}
            >
              {(AVAILABLE_MODELS[config.subAgentModel.provider] ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div>
        <div className="text-label-medium text-accent-black mb-10">Max Steps</div>
        <input
          type="number"
          min={1}
          max={50}
          className="w-120 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium focus:border-heat-100 focus:outline-none"
          value={config.maxSteps ?? 20}
          onChange={(e) => onChange({ ...config, maxSteps: parseInt(e.target.value) || 20 })}
        />
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-8 text-label-medium text-black-alpha-40 hover:text-accent-black transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" className={cn("transition-transform", showAdvanced && "rotate-90")} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
          Per-operation sub-agent model overrides
        </button>
        <p className="text-body-small text-black-alpha-24 mt-4 ml-20">Override which model sub-agents use for specific operations.</p>

        {showAdvanced && (
          <div className="mt-14 flex flex-col gap-12 pl-20 border-l-2 border-border-faint">
            {OPERATIONS.map((op) => {
              const override = config.operationModels?.[op.id];
              return (
                <div key={op.id}>
                  <div className="flex items-center gap-8 mb-6">
                    <span className="text-label-small text-black-alpha-48">{op.label}</span>
                    {!override && <span className="text-mono-x-small text-black-alpha-20">(default)</span>}
                  </div>
                  <div className="flex gap-6">
                    <select
                      className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
                      value={override?.provider ?? ""}
                      onChange={(e) => {
                        const opModels = { ...(config.operationModels ?? {}) };
                        if (!e.target.value) { delete opModels[op.id]; }
                        else {
                          const provider = e.target.value as ModelConfig["provider"];
                          const models = AVAILABLE_MODELS[provider] ?? [];
                          opModels[op.id] = { provider, model: models[0]?.id ?? "" };
                        }
                        onChange({ ...config, operationModels: Object.keys(opModels).length ? opModels : undefined });
                      }}
                    >
                      <option value="">Default</option>
                      {availableProviders.map((p) => (
                        <option key={p} value={p}>{PROVIDER_META[p].name}</option>
                      ))}
                    </select>
                    {override && (
                      <select
                        className="flex-1 bg-background-base border border-black-alpha-8 rounded-10 px-12 py-8 text-body-small appearance-none cursor-pointer focus:border-heat-100 focus:outline-none"
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
  );
}

export default function SettingsPanel({ config, onChange }: { config: AgentConfig; onChange: (config: AgentConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("firecrawl");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
  const [hosted, setHosted] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) { const data: ConfigResponse = await res.json(); setKeyStatuses(data.keys); setHosted(data.hosted); }
    } catch { /* noop */ }
  }, []);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data: SkillInfo[] = await res.json();
        setSkills(data.filter((s) => s.category !== "Export"));
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (open) { fetchKeys(); fetchSkills(); }
  }, [open, fetchKeys, fetchSkills]);

  const saveKey = async (id: string) => {
    const value = keyDrafts[id]?.trim();
    if (!value) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: { [id]: value } }) });
      const data = await res.json();
      if (res.ok) { setKeyStatuses(data.keys); setKeyDrafts((prev) => ({ ...prev, [id]: "" })); setSaveMsg(hosted ? "Saved for this session" : "Saved to .env.local"); setTimeout(() => setSaveMsg(""), 3000); }
      else setSaveMsg(data.error || "Failed to save");
    } catch { setSaveMsg("Network error"); }
    finally { setSaving(false); }
  };

  const removeKey = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: { [id]: "" } }) });
      const data = await res.json();
      if (res.ok) { setKeyStatuses(data.keys); setSaveMsg("Key removed"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch { /* noop */ }
    finally { setSaving(false); }
  };

  const activeProvider = PROVIDERS.find((p) => p.id === activeSection);
  const activeSkill = skills.find((s) => s.name === activeSection);

  return (
    <>
      <button type="button" className="p-8 rounded-8 text-black-alpha-40 bg-black-alpha-4 hover:bg-black-alpha-8 hover:text-accent-black transition-all" onClick={() => setOpen(true)}>
        <GearIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-40">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          <div
            className="relative bg-accent-white rounded-20 border border-border-muted overflow-hidden flex w-full max-w-[960px] h-full max-h-[640px]"
            style={{ boxShadow: "0px 32px 80px -16px rgba(0,0,0,0.18), 0px 8px 32px -4px rgba(0,0,0,0.08)" }}
          >
            {/* Sidebar */}
            <div className="w-[240px] border-r border-border-faint bg-background-base flex flex-col flex-shrink-0">
              <div className="px-20 py-16 border-b border-border-faint">
                <div className="text-label-large text-accent-black">Settings</div>
              </div>

              <nav className="flex-1 overflow-y-auto py-4">
                <SidebarSection label="Providers" />
                {PROVIDERS.map((p) => (
                  <SidebarItem
                    key={p.id}
                    active={activeSection === p.id}
                    icon={<ProviderModelIcon icon={p.icon} size={16} />}
                    label={p.label}
                    right={<StatusDot configured={keyStatuses[p.id]?.configured ?? false} required={p.required} />}
                    onClick={() => { setActiveSection(p.id); setSaveMsg(""); }}
                  />
                ))}

                {skills.length > 0 && (
                  <>
                    <SidebarSection label="Skills" />
                    {skills.map((s) => (
                      <SidebarItem
                        key={s.name}
                        active={activeSection === s.name}
                        icon={
                          <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                          </svg>
                        }
                        label={s.name}
                        right={config.skillInstructions?.[s.name] ? (
                          <div className="w-6 h-6 rounded-full bg-heat-100 flex-shrink-0" />
                        ) : undefined}
                        onClick={() => { setActiveSection(s.name); setSaveMsg(""); }}
                      />
                    ))}
                  </>
                )}

                <SidebarSection label="Config" />
                <SidebarItem
                  active={activeSection === "general"}
                  icon={
                    <svg fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                  }
                  label="General"
                  onClick={() => { setActiveSection("general"); setSaveMsg(""); }}
                />
              </nav>

              <div className="px-16 py-12 border-t border-border-faint">
                <div className="text-mono-x-small text-black-alpha-20">{hosted ? "Hosted mode" : ".env.local"}</div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <button
                type="button"
                className="absolute top-16 right-16 p-6 rounded-10 text-black-alpha-32 hover:text-accent-black hover:bg-black-alpha-4 transition-all z-10"
                onClick={() => setOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <div className="flex-1 overflow-y-auto p-32">
                {activeProvider && (
                  <ProviderView
                    provider={activeProvider}
                    status={keyStatuses[activeProvider.id]}
                    keyDraft={keyDrafts[activeProvider.id] ?? ""}
                    onDraftChange={(v) => setKeyDrafts((prev) => ({ ...prev, [activeProvider.id]: v }))}
                    onSave={() => saveKey(activeProvider.id)}
                    onRemove={() => removeKey(activeProvider.id)}
                    saving={saving}
                    saveMsg={saveMsg}
                    hosted={hosted}
                  />
                )}

                {activeSkill && (
                  <SkillView
                    skill={activeSkill}
                    instructions={config.skillInstructions?.[activeSkill.name] ?? ""}
                    onInstructionsChange={(v) => {
                      const updated = { ...(config.skillInstructions ?? {}), [activeSkill.name]: v };
                      if (!v) delete updated[activeSkill.name];
                      onChange({ ...config, skillInstructions: Object.keys(updated).length ? updated : undefined });
                    }}
                  />
                )}

                {activeSection === "general" && <GeneralView config={config} onChange={onChange} keyStatuses={keyStatuses} />}
              </div>

              <div className="px-32 py-14 border-t border-border-faint bg-background-base flex items-center gap-10">
                <ProviderModelIcon icon={AVAILABLE_MODELS[config.model.provider]?.find(m => m.id === config.model.model)?.icon ?? "openai"} size={16} />
                <span className="text-body-small text-black-alpha-40">{AVAILABLE_MODELS[config.model.provider]?.find(m => m.id === config.model.model)?.name ?? config.model.model}</span>
                <span className="text-black-alpha-12">|</span>
                <span className="text-body-small text-black-alpha-40">{config.maxSteps ?? 20} steps</span>
                {config.subAgentModel && (
                  <>
                    <span className="text-black-alpha-12">|</span>
                    <span className="text-body-small text-black-alpha-40">Sub: {AVAILABLE_MODELS[config.subAgentModel.provider]?.find(m => m.id === config.subAgentModel!.model)?.name ?? config.subAgentModel.model}</span>
                  </>
                )}
                {config.skillInstructions && Object.keys(config.skillInstructions).length > 0 && (
                  <>
                    <span className="text-black-alpha-12">|</span>
                    <span className="text-body-small text-black-alpha-40">{Object.keys(config.skillInstructions).length} skill{Object.keys(config.skillInstructions).length !== 1 ? "s" : ""} configured</span>
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
