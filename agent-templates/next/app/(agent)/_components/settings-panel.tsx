"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentConfig, ModelConfig } from "@/agent-core-types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@agent/_lib/config/models";
import { getExperimentalFeatures } from "@agent/_config";
import ProviderModelIcon from "./provider-icon";
import { cn } from "@/utils/cn";

type KeyStatus = { configured: boolean; masked: string; source: string };
type ValueStatus = { configured: boolean; value: string; source: string };
type ConfigResponse = { keys: Record<string, KeyStatus>; values: Record<string, ValueStatus>; hosted: boolean; writable: boolean };
type SkillInfo = { name: string; description: string; category: string; resources: string[] };

// Admin token stored client-side for hosted deployments. Matches the server's
// CONFIG_ADMIN_TOKEN. Kept in localStorage so it survives reloads but stays
// off the network until attached as a Bearer header on /api/config calls.
const CONFIG_TOKEN_KEY = "firecrawl-agent-config-token";

function getConfigToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CONFIG_TOKEN_KEY) ?? "";
}

function configHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  const token = getConfigToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const EXPERIMENTAL = getExperimentalFeatures();

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
  ...(EXPERIMENTAL.customOpenAI ? [{ id: "customOpenAI", label: "Custom OpenAI", icon: "openai", envVar: "CUSTOM_OPENAI_API_KEY", placeholder: "sk-...", description: "Any OpenAI-compatible provider using your own base URL and model IDs.", required: false, hasModels: true, provider: "custom-openai" as Provider, extraField: { id: "customOpenAIBaseURL", label: "Base URL", placeholder: "https://openrouter.ai/api/v1", help: "Saved separately and used as the default base URL for the custom-openai provider." } }] : []),
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
  extraStatus,
  keyDraft,
  extraDraft,
  onDraftChange,
  onExtraDraftChange,
  onSave,
  onRemove,
  onSaveExtra,
  onRemoveExtra,
  saving,
  saveMsg,
  hosted,
}: {
  provider: typeof PROVIDERS[number];
  status?: KeyStatus;
  extraStatus?: ValueStatus;
  keyDraft: string;
  extraDraft: string;
  onDraftChange: (v: string) => void;
  onExtraDraftChange: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onSaveExtra: () => void;
  onRemoveExtra: () => void;
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

      {provider.extraField && (
        <div>
          <div className="text-label-medium text-accent-black mb-10">{provider.extraField.label}</div>
          <div className="flex items-center gap-10">
            <input
              type="url"
              className="flex-1 bg-background-base border border-black-alpha-8 rounded-12 px-16 py-12 text-body-medium placeholder:text-black-alpha-20 focus:border-heat-100 focus:outline-none"
              placeholder={provider.extraField.placeholder}
              value={extraDraft}
              onChange={(e) => onExtraDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveExtra(); }}
            />
            <button
              type="button"
              disabled={saving || (!extraDraft.trim() && !extraStatus?.configured)}
              className={cn(
                "px-16 py-10 rounded-12 text-label-small transition-all",
                extraDraft.trim() || extraStatus?.configured ? "bg-accent-black text-accent-white hover:bg-black-alpha-80" : "bg-black-alpha-4 text-black-alpha-24 cursor-not-allowed"
              )}
              onClick={extraDraft.trim() ? onSaveExtra : onRemoveExtra}
            >
              {saving ? "Saving..." : extraDraft.trim() ? (extraStatus?.configured ? "Update" : "Save") : "Remove"}
            </button>
          </div>
          {extraStatus?.configured && !extraDraft.trim() && (
            <div className="mt-8 text-mono-x-small text-black-alpha-20 break-all">Current: {extraStatus.value}</div>
          )}
          <div className="mt-10 text-mono-x-small text-black-alpha-20">{provider.extraField.help}</div>
        </div>
      )}

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
          Additional instructions injected when this skill is loaded by the orchestrator or any subagent.
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
        <p className="text-body-medium text-black-alpha-48">Orchestrator and subagent model configuration.</p>
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
          <span className="text-label-medium text-accent-black">Subagent Model</span>
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

    </div>
  );
}

export default function SettingsPanel({ config, onChange }: { config: AgentConfig; onChange: (config: AgentConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("firecrawl");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});
  const [valueStatuses, setValueStatuses] = useState<Record<string, ValueStatus>>({});
  const [hosted, setHosted] = useState(false);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenSet, setTokenSet] = useState(false);

  useEffect(() => {
    setTokenSet(getConfigToken() !== "");
  }, [open]);

  // Distinguishes the three outcomes so callers can show an accurate
  // message — a network blip should not look like "token rejected".
  type FetchKeysResult = "ok" | "rejected" | "error";
  const fetchKeys = useCallback(async (): Promise<FetchKeysResult> => {
    let res: Response;
    try {
      // On hosted deployments the GET is guarded too — attach token if we have one.
      res = await fetch("/api/config", { headers: configHeaders(false) });
    } catch {
      return "error";
    }
    if (res.status === 401 || res.status === 403) {
      // The token (if any) is rejected. Drop it so the user doesn't
      // stay locked out on the next render with stale creds in storage.
      window.localStorage.removeItem(CONFIG_TOKEN_KEY);
      setTokenSet(false);
      setAuthRequired(true);
      setHosted(true);
      return "rejected";
    }
    if (res.ok) {
      try {
        const data: ConfigResponse = await res.json();
        setKeyStatuses(data.keys);
        setValueStatuses(data.values ?? {});
        setHosted(data.hosted);
        setAuthRequired(false);
        return "ok";
      } catch {
        return "error";
      }
    }
    return "error";
  }, []);

  const saveAdminToken = async () => {
    const t = tokenDraft.trim();
    if (!t) return;
    window.localStorage.setItem(CONFIG_TOKEN_KEY, t);
    setTokenSet(true);
    setTokenDraft("");
    const result = await fetchKeys();
    const msg =
      result === "ok" ? "Admin token saved"
      : result === "rejected" ? "Token rejected by server"
      : "Network error — token saved locally, retry when reachable";
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const clearAdminToken = () => {
    window.localStorage.removeItem(CONFIG_TOKEN_KEY);
    setTokenSet(false);
    setSaveMsg("Admin token cleared");
    setTimeout(() => setSaveMsg(""), 3000);
    void fetchKeys();
  };

  const fetchSkills = useCallback(async () => {
    try {
      // /api/skills is unauthenticated; keep the admin token out of its
      // request surface (server logs, future proxies) until the endpoint
      // actually requires it.
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data: SkillInfo[] = await res.json();
        setSkills(data.filter((s) => s.category !== "Export"));
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (open) { void fetchKeys(); void fetchSkills(); }
  }, [open, fetchKeys, fetchSkills]);

  // Mirror fetchKeys's 401/403 recovery on every config write: a
  // rejected token must be dropped from localStorage and the UI must
  // flip to the auth-required state, otherwise the user is stuck with a
  // stale token and a generic "Failed to save" message.
  const handleAuthFailure = () => {
    window.localStorage.removeItem(CONFIG_TOKEN_KEY);
    setTokenSet(false);
    setAuthRequired(true);
    setHosted(true);
    setSaveMsg("Token rejected — re-enter admin token");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const saveKey = async (id: string) => {
    const value = keyDrafts[id]?.trim();
    if (!value) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/config", { method: "POST", headers: configHeaders(), body: JSON.stringify({ keys: { [id]: value } }) });
      if (res.status === 401 || res.status === 403) { handleAuthFailure(); return; }
      const data = await res.json();
      if (res.ok) { setKeyStatuses(data.keys); setKeyDrafts((prev) => ({ ...prev, [id]: "" })); setSaveMsg(hosted ? "Saved for this session" : "Saved to .env.local"); setTimeout(() => setSaveMsg(""), 3000); }
      else setSaveMsg(data.error || "Failed to save");
    } catch { setSaveMsg("Network error"); }
    finally { setSaving(false); }
  };

  const removeKey = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", { method: "POST", headers: configHeaders(), body: JSON.stringify({ keys: { [id]: "" } }) });
      if (res.status === 401 || res.status === 403) { handleAuthFailure(); return; }
      const data = await res.json();
      if (res.ok) { setKeyStatuses(data.keys); setSaveMsg("Key removed"); setTimeout(() => setSaveMsg(""), 3000); }
    } catch { /* noop */ }
    finally { setSaving(false); }
  };

  const saveValue = async (id: string) => {
    const value = valueDrafts[id]?.trim();
    if (!value) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/config", { method: "POST", headers: configHeaders(), body: JSON.stringify({ values: { [id]: value } }) });
      if (res.status === 401 || res.status === 403) { handleAuthFailure(); return; }
      const data = await res.json();
      if (res.ok) {
        setValueStatuses(data.values ?? {});
        setValueDrafts((prev) => ({ ...prev, [id]: "" }));
        setSaveMsg(hosted ? "Saved for this session" : "Saved to .env.local");
        setTimeout(() => setSaveMsg(""), 3000);
      } else setSaveMsg(data.error || "Failed to save");
    } catch { setSaveMsg("Network error"); }
    finally { setSaving(false); }
  };

  const removeValue = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", { method: "POST", headers: configHeaders(), body: JSON.stringify({ values: { [id]: "" } }) });
      if (res.status === 401 || res.status === 403) { handleAuthFailure(); return; }
      const data = await res.json();
      if (res.ok) {
        setValueStatuses(data.values ?? {});
        setSaveMsg("Value removed");
        setTimeout(() => setSaveMsg(""), 3000);
      }
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
                {(hosted || authRequired) && (
                  <div className={cn(
                    "mb-24 rounded-12 border p-16",
                    authRequired
                      ? "border-heat-100 bg-heat-8"
                      : "border-border-faint bg-background-base"
                  )}>
                    <div className="text-label-medium text-accent-black mb-4">Admin token</div>
                    <div className="text-body-small text-black-alpha-64 mb-10">
                      {authRequired
                        ? "This deployment requires CONFIG_ADMIN_TOKEN to read or change config. Paste it below."
                        : "Sent as Authorization: Bearer with every config update. Must match CONFIG_ADMIN_TOKEN on the server."}
                    </div>
                    <div className="flex gap-8">
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder={tokenSet ? "••••••••  (stored locally)" : "Paste token"}
                        className="flex-1 bg-accent-white border border-black-alpha-8 rounded-12 px-16 py-10 text-body-medium focus:border-heat-100 focus:outline-none"
                        value={tokenDraft}
                        onChange={(e) => setTokenDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveAdminToken(); }}
                      />
                      <button
                        type="button"
                        disabled={!tokenDraft.trim()}
                        className="px-16 py-10 rounded-12 bg-accent-black text-accent-white text-label-medium disabled:opacity-40"
                        onClick={saveAdminToken}
                      >
                        Save
                      </button>
                      {tokenSet && (
                        <button
                          type="button"
                          className="px-16 py-10 rounded-12 border border-black-alpha-8 text-label-medium text-accent-black hover:bg-black-alpha-4"
                          onClick={clearAdminToken}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {activeProvider && (
                  <ProviderView
                    provider={activeProvider}
                    status={keyStatuses[activeProvider.id]}
                    extraStatus={activeProvider.extraField ? valueStatuses[activeProvider.extraField.id] : undefined}
                    keyDraft={keyDrafts[activeProvider.id] ?? ""}
                    extraDraft={activeProvider.extraField ? (valueDrafts[activeProvider.extraField.id] ?? "") : ""}
                    onDraftChange={(v) => setKeyDrafts((prev) => ({ ...prev, [activeProvider.id]: v }))}
                    onExtraDraftChange={(v) => activeProvider.extraField && setValueDrafts((prev) => ({ ...prev, [activeProvider.extraField.id]: v }))}
                    onSave={() => saveKey(activeProvider.id)}
                    onRemove={() => removeKey(activeProvider.id)}
                    onSaveExtra={() => activeProvider.extraField && saveValue(activeProvider.extraField.id)}
                    onRemoveExtra={() => activeProvider.extraField && removeValue(activeProvider.extraField.id)}
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
