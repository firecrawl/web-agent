"use client";

import type { SubAgentConfig, ModelConfig } from "@/agent-core-types";
import ModelSelector from "./model-selector";
import SkillSelector from "./skill-selector";
import { cn } from "@/utils/cn";

const TOOL_OPTIONS = [
  { id: "search" as const, label: "Search" },
  { id: "scrape" as const, label: "Scrape" },
  { id: "interact" as const, label: "Interact" },
  { id: "map" as const, label: "Map" },
];

import { getSubAgentModel } from "@agent/_config";

const defaultModel: ModelConfig = getSubAgentModel();

export default function SubAgentConfigurator({
  agents,
  onChange,
}: {
  agents: SubAgentConfig[];
  onChange: (agents: SubAgentConfig[]) => void;
}) {
  const addAgent = () => {
    const id = `sa-${Date.now()}`;
    onChange([
      ...agents,
      {
        id,
        name: "",
        description: "",
        model: defaultModel,
        tools: ["search", "scrape"],
        skills: [],
      },
    ]);
  };

  const updateAgent = (index: number, partial: Partial<SubAgentConfig>) => {
    const updated = [...agents];
    updated[index] = { ...updated[index], ...partial };
    onChange(updated);
  };

  const removeAgent = (index: number) => {
    onChange(agents.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-12">
      {agents.map((agent, i) => (
        <div
          key={agent.id}
          className="border border-border-muted rounded-12 p-12 flex flex-col gap-10 bg-accent-white"
        >
          <div className="flex items-center justify-between">
            <span className="text-label-small text-black-alpha-56">
              Sub-agent {i + 1}
            </span>
            <button
              type="button"
              className="text-body-small text-black-alpha-48 hover:text-accent-crimson transition-colors"
              onClick={() => removeAgent(i)}
            >
              Remove
            </button>
          </div>

          <input
            className="w-full bg-background-base border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium placeholder:text-black-alpha-32 focus:border-heat-100 focus:outline-none transition-all"
            placeholder="Name (e.g. research-agent)"
            value={agent.name}
            onChange={(e) => updateAgent(i, { name: e.target.value })}
          />

          <input
            className="w-full bg-background-base border border-black-alpha-8 rounded-8 px-10 py-6 text-body-medium placeholder:text-black-alpha-32 focus:border-heat-100 focus:outline-none transition-all"
            placeholder="Description (e.g. Specializes in web research)"
            value={agent.description}
            onChange={(e) => updateAgent(i, { description: e.target.value })}
          />

          <div>
            <div className="text-label-x-small text-black-alpha-56 mb-6">
              Model
            </div>
            <ModelSelector
              compact
              value={agent.model}
              onChange={(model) => updateAgent(i, { model })}
            />
          </div>

          <div>
            <div className="text-label-x-small text-black-alpha-56 mb-6">
              Tools
            </div>
            <div className="flex gap-6 flex-wrap">
              {TOOL_OPTIONS.map((t) => {
                const active = agent.tools.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "px-10 py-4 rounded-6 text-label-small transition-all",
                      active
                        ? "bg-heat-12 text-heat-100 border border-heat-40"
                        : "bg-black-alpha-4 text-black-alpha-56 border border-transparent hover:bg-black-alpha-6",
                    )}
                    onClick={() =>
                      updateAgent(i, {
                        tools: active
                          ? agent.tools.filter((x) => x !== t.id)
                          : [...agent.tools, t.id],
                      })
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-label-x-small text-black-alpha-56 mb-6">
              Skills
            </div>
            <SkillSelector
              selected={agent.skills}
              onChange={(skills) => updateAgent(i, { skills })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        className="w-full py-8 rounded-8 border border-dashed border-black-alpha-12 text-label-small text-black-alpha-48 hover:bg-black-alpha-2 hover:border-black-alpha-20 transition-all"
        onClick={addAgent}
      >
        + Add sub-agent
      </button>
    </div>
  );
}
