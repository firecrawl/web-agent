import fs from "fs/promises";
import path from "path";
import type { SkillMetadata } from "../types";
import { parseSkillFrontmatter } from "./parser";

const DEFAULT_SKILLS_DIR = path.join(process.cwd(), ".agents", "skills");

export async function discoverSkills(
  skillsDir: string = DEFAULT_SKILLS_DIR,
): Promise<SkillMetadata[]> {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: SkillMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillFile = path.join(skillDir, "SKILL.md");

      try {
        const content = await fs.readFile(skillFile, "utf-8");
        const meta = parseSkillFrontmatter(content);

        const files = await fs.readdir(skillDir);
        const resources = files.filter(
          (f) => f !== "SKILL.md" && !f.startsWith("."),
        );

        skills.push({
          name: meta.name || entry.name,
          description: meta.description || "",
          category: meta.category,
          directory: skillDir,
          resources,
        });
      } catch {
        // Skip directories without valid SKILL.md
      }
    }

    return skills;
  } catch {
    return [];
  }
}
