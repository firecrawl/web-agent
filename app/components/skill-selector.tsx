"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface SkillInfo {
  name: string;
  description: string;
}

export default function SkillSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
}) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => setSkills(data))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-body-small text-black-alpha-48">
        Loading skills...
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-body-small text-black-alpha-48">
        No skills found. Add SKILL.md files to{" "}
        <code className="text-mono-small bg-black-alpha-4 px-4 rounded-4">
          agent-core/src/skills/definitions/
        </code>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {skills.map((skill) => {
        const isActive = selected.includes(skill.name);
        return (
          <button
            key={skill.name}
            type="button"
            className={cn(
              "flex items-start gap-8 p-8 rounded-8 text-left transition-all",
              isActive
                ? "bg-heat-8 border border-heat-40"
                : "bg-black-alpha-2 border border-transparent hover:bg-black-alpha-4",
            )}
            onClick={() =>
              onChange(
                isActive
                  ? selected.filter((s) => s !== skill.name)
                  : [...selected, skill.name],
              )
            }
          >
            <div
              className={cn(
                "w-16 h-16 rounded-4 border-2 mt-2 flex-shrink-0 transition-all",
                isActive
                  ? "bg-heat-100 border-heat-100"
                  : "border-black-alpha-16",
              )}
            >
              {isActive && (
                <svg viewBox="0 0 16 16" className="text-white w-full h-full">
                  <path
                    d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1-5.5 5.5z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </div>
            <div>
              <div className="text-label-small text-accent-black">
                {skill.name}
              </div>
              <div className="text-body-small text-black-alpha-56 line-clamp-2">
                {skill.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
