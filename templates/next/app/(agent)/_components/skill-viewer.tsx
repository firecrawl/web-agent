"use client";

import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";

interface SkillInfo {
  name: string;
  description: string;
}

export default function SkillViewer() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  const loadSkill = async (name: string) => {
    if (selected === name) {
      setSelected(null);
      return;
    }
    setSelected(name);
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${name}`);
      const data = await res.json();
      setContent(data.content ?? "No content available");
    } catch {
      setContent("Failed to load skill");
    }
    setLoading(false);
  };

  if (skills.length === 0) return null;

  return (
    <div className="border-t border-border-faint mt-20 pt-16">
      <div className="text-label-small text-black-alpha-40 mb-10">
        Available Skills
      </div>
      <div className="flex flex-col gap-4">
        {skills.map((skill) => (
          <div key={skill.name}>
            <button
              type="button"
              className={cn(
                "w-full text-left px-12 py-8 rounded-10 transition-all flex items-center gap-10",
                selected === skill.name
                  ? "bg-heat-4 border border-heat-20"
                  : "hover:bg-black-alpha-2 border border-transparent",
              )}
              onClick={() => loadSkill(skill.name)}
            >
              <div className="w-28 h-28 rounded-8 border border-black-alpha-8 flex-center flex-shrink-0 bg-accent-white">
                <svg
                  fill="none"
                  height="16"
                  viewBox="0 0 24 24"
                  width="16"
                  className="text-black-alpha-32"
                >
                  <path
                    d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5zM8 14h8l2 8H6l2-8z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-label-medium text-accent-black">
                  {skill.name}
                </div>
                <div className="text-body-small text-black-alpha-40 truncate">
                  {skill.description}
                </div>
              </div>
              <svg
                fill="none"
                height="16"
                viewBox="0 0 20 20"
                width="16"
                className={cn(
                  "text-black-alpha-24 transition-transform flex-shrink-0",
                  selected === skill.name && "rotate-180",
                )}
              >
                <path
                  d="M5 7.5l5 5 5-5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>

            {selected === skill.name && (
              <div className="ml-38 mt-4 mb-8">
                {loading ? (
                  <div className="text-body-small text-black-alpha-32 py-8">
                    Loading...
                  </div>
                ) : (
                  <pre className="text-mono-small text-black-alpha-56 whitespace-pre-wrap bg-background-lighter rounded-8 p-12 border border-border-faint max-h-300 overflow-auto">
                    {content}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
