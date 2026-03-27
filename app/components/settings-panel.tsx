"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentConfig } from "@/lib/types";
import { AVAILABLE_MODELS, PROVIDER_META, type Provider } from "@/lib/config/models";
import ProviderModelIcon from "./provider-icon";
import { cn } from "@/utils/cn";

function GearIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const providerKeys = Object.keys(PROVIDER_META) as Provider[];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="p-8 rounded-8 text-black-alpha-40 hover:text-accent-black hover:bg-black-alpha-4 transition-all"
        onClick={() => setOpen(!open)}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-6 w-380 bg-accent-white rounded-16 border border-border-muted overflow-hidden z-50"
          style={{
            boxShadow:
              "0px 16px 48px -8px rgba(0,0,0,0.1), 0px 4px 16px -2px rgba(0,0,0,0.05)",
          }}
        >
          <div className="px-16 py-12 border-b border-border-faint">
            <div className="text-label-large text-accent-black">Settings</div>
          </div>

          {/* Model selection */}
          <div className="p-16">
            <div className="text-label-small text-black-alpha-48 mb-8">
              Model
            </div>
            <div className="flex gap-6 mb-12">
              <select
                className="flex-1 bg-background-base border border-black-alpha-8 rounded-8 px-10 py-8 text-body-medium appearance-none cursor-pointer hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none"
                value={config.model.provider}
                onChange={(e) =>
                  onChange({
                    ...config,
                    model: {
                      ...config.model,
                      provider: e.target.value as Provider,
                      model:
                        AVAILABLE_MODELS[e.target.value as Provider][0].id,
                    },
                  })
                }
              >
                {providerKeys.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_META[p].name}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 bg-background-base border border-black-alpha-8 rounded-8 px-10 py-8 text-body-medium appearance-none cursor-pointer hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none"
                value={config.model.model}
                onChange={(e) =>
                  onChange({
                    ...config,
                    model: { ...config.model, model: e.target.value },
                  })
                }
              >
                {AVAILABLE_MODELS[config.model.provider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="text-label-small text-black-alpha-48 mb-8">
              API Key
            </div>
            <input
              type="password"
              className="w-full bg-background-base border border-black-alpha-8 rounded-8 px-10 py-8 text-body-medium placeholder:text-black-alpha-24 hover:border-black-alpha-12 focus:border-heat-100 focus:outline-none mb-12"
              placeholder="Uses server default if empty"
              value={config.model.apiKey ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  model: {
                    ...config.model,
                    apiKey: e.target.value || undefined,
                  },
                })
              }
            />

            {/* Max steps */}
            <div className="text-label-small text-black-alpha-48 mb-8">
              Max Steps
            </div>
            <input
              type="number"
              min={1}
              max={50}
              className="w-80 bg-background-base border border-black-alpha-8 rounded-8 px-10 py-8 text-body-medium focus:border-heat-100 focus:outline-none"
              value={config.maxSteps ?? 20}
              onChange={(e) =>
                onChange({
                  ...config,
                  maxSteps: parseInt(e.target.value) || 20,
                })
              }
            />
          </div>

          {/* Current config summary */}
          <div className="px-16 py-10 border-t border-border-faint bg-background-base">
            <div className="flex items-center gap-6 text-body-small text-black-alpha-40">
              <ProviderModelIcon
                icon={
                  AVAILABLE_MODELS[config.model.provider]?.find(
                    (m) => m.id === config.model.model,
                  )?.icon ?? "openai"
                }
                size={14}
              />
              <span>
                {AVAILABLE_MODELS[config.model.provider]?.find(
                  (m) => m.id === config.model.model,
                )?.name ?? config.model.model}
              </span>
              <span className="text-black-alpha-16">·</span>
              <span>{config.maxSteps ?? 20} steps</span>
              {config.model.apiKey && (
                <>
                  <span className="text-black-alpha-16">·</span>
                  <span className="text-accent-forest">Custom key</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
