import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import type { SkillMetadata } from "../types";
import { parseSkillBody } from "./parser";

export function createSkillTools(skills: SkillMetadata[]) {
  const skillMap = new Map(skills.map((s) => [s.name, s]));

  const catalogDescription = skills.length
    ? `Load a skill's full instructions. Available: ${skills.map((s) => `${s.name} (${s.description.slice(0, 60)})`).join("; ")}`
    : "Load a skill's instructions by name. No skills currently available.";

  return {
    load_skill: tool({
      description: catalogDescription,
      inputSchema: z.object({
        name: z.string().describe("The skill name to load"),
      }),
      execute: async ({ name }) => {
        const skill = skillMap.get(name);
        if (!skill) return { error: `Skill "${name}" not found` };
        const content = await fs.readFile(
          path.join(skill.directory, "SKILL.md"),
          "utf-8",
        );
        return { name: skill.name, instructions: parseSkillBody(content) };
      },
    }),

    read_skill_resource: tool({
      description:
        "Read a file from a skill directory. Use after loading a skill to access its scripts or reference docs.",
      inputSchema: z.object({
        skill: z.string().describe("The skill name"),
        file: z.string().describe("The filename to read"),
      }),
      execute: async ({ skill: skillName, file }) => {
        const skill = skillMap.get(skillName);
        if (!skill) return { error: `Skill "${skillName}" not found` };

        const resolved = path.resolve(skill.directory, file);
        if (!resolved.startsWith(skill.directory)) {
          return { error: "Access denied: path traversal detected" };
        }

        try {
          const content = await fs.readFile(resolved, "utf-8");
          return { file, content };
        } catch {
          return {
            error: `File "${file}" not found. Available: ${skill.resources.join(", ")}`,
          };
        }
      },
    }),
  };
}
