"use client";

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
];

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
    </div>
  );
}
