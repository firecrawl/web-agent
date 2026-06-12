"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS, type Provider } from "@agent/_lib/config/models";
import { getExperimentalFeatures } from "@agent/_config";
import type { ModelConfig } from "@/agent-core-types";
import { cn } from "@/utils/cn";

const EXPERIMENTAL = getExperimentalFeatures();

const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "gateway", name: "AI Gateway" },
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  ...(EXPERIMENTAL.customOpenAI ? [{ id: "custom-openai" as Provider, name: "Custom OpenAI" }] : []),
  { id: "google", name: "Google" },
  { id: "atomic-chat", name: "Atomic Chat" },
];

// Provider → (label, docs URL). Used to point users at the right console when
// their selected provider has no key configured.
const PROVIDER_DOCS: Record<Provider, { label: string; url: string }> = {
  anthropic:       { label: "Anthropic",    url: "https://console.anthropic.com/settings/keys" },
  openai:          { label: "OpenAI",       url: "https://platform.openai.com/api-keys" },
  google:          { label: "Google AI",    url: "https://aistudio.google.com/apikey" },
  gateway:         { label: "AI Gateway",   url: "https://vercel.com/dashboard/ai-gateway" },
  "custom-openai": { label: "Custom OpenAI", url: "" },
  "atomic-chat":   { label: "Atomic Chat",  url: "https://atomic.chat" },
  firecrawl:       { label: "Firecrawl",    url: "https://firecrawl.dev/app/api-keys" },
};

// Keys returned by /api/config are keyed by the KeyId in keys.ts, not the
// provider string — normalize here.
const PROVIDER_TO_KEY_ID: Record<Provider, string | null> = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google",
  gateway: "gateway",
  "custom-openai": "customOpenAI",
  "atomic-chat": "atomicChat",
  firecrawl: "firecrawl",
};

export default function ModelSelector({
  value,
  onChange,
  compact,
}: {
  value: ModelConfig;
  onChange: (config: ModelConfig) => void;
  compact?: boolean;
}) {
  const models = AVAILABLE_MODELS[value.provider] ?? [];
  const [keyStatuses, setKeyStatuses] = useState<Record<string, { configured: boolean }>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { keys?: Record<string, { configured: boolean }> } | null) => {
        if (!cancelled && data?.keys) setKeyStatuses(data.keys);
      })
      .catch(() => { /* best-effort — warning just won't show */ });
    return () => { cancelled = true; };
  }, []);

  const keyId = PROVIDER_TO_KEY_ID[value.provider];
  const docs = PROVIDER_DOCS[value.provider];
  const serverHasKey = keyId ? !!keyStatuses[keyId]?.configured : false;
  const inlineHasKey = !!value.apiKey?.trim();
  const needsKey = !!docs?.url && !serverHasKey && !inlineHasKey;

  return (
    <div className={cn("flex flex-col gap-8", compact && "gap-6")}>
      <div className="flex gap-6">
        <select
          className="flex-1 bg-accent-white border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium appearance-none cursor-pointer hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none transition-all"
          value={value.provider}
          onChange={(e) =>
            onChange({
              ...value,
              provider: e.target.value as ModelConfig["provider"],
              model: (AVAILABLE_MODELS[e.target.value as string] ?? [])[0]?.id ?? "",
            })
          }
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {value.provider === "custom-openai" ? (
          <input
            className="flex-1 bg-accent-white border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium placeholder:text-black-alpha-32 hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none transition-all"
            placeholder="Custom model ID"
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
          />
        ) : (
          <select
            className="flex-1 bg-accent-white border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium appearance-none cursor-pointer hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none transition-all"
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="relative">
        <input
          type="password"
          className="w-full bg-accent-white border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium placeholder:text-black-alpha-32 hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none transition-all"
          placeholder={`${value.provider} API key (optional — uses server default)`}
          value={value.apiKey ?? ""}
          onChange={(e) =>
            onChange({ ...value, apiKey: e.target.value || undefined })
          }
        />
      </div>

      {value.provider === "custom-openai" && (
        <div className="relative">
          <input
            type="url"
            className="w-full bg-accent-white border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium placeholder:text-black-alpha-32 hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none transition-all"
            placeholder="Base URL (optional — uses server default)"
            value={value.baseURL ?? ""}
            onChange={(e) => onChange({ ...value, baseURL: e.target.value || undefined })}
          />
        </div>
      )}

      {needsKey && (
        <div className="px-10 py-8 border border-heat-100/30 bg-heat-100/6 text-body-small text-accent-black">
          <div className="flex items-center gap-6">
            <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-heat-100 flex-shrink-0">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>No {docs.label} key configured.</span>
          </div>
          <a
            href={docs.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-4 text-label-small text-heat-100 hover:underline"
          >
            Get an API key →
          </a>
        </div>
      )}
    </div>
  );
}
