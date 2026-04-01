import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { SkillMetadata, SitePlaybook } from "../types";
import { parseSkillFrontmatter } from "./parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_DIR = path.join(__dirname, "definitions");

async function discoverSitePlaybooks(skillDir: string): Promise<SitePlaybook[]> {
  const sitesDir = path.join(skillDir, "sites");
  try {
    const files = await fs.readdir(sitesDir);
    const playbooks: SitePlaybook[] = [];
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(sitesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const meta = parseSkillFrontmatter(content);
      if (meta.domains?.length) {
        playbooks.push({
          name: file.replace(/\.md$/, ""),
          platform: meta.platform || file.replace(/\.md$/, ""),
          domains: meta.domains,
          filePath,
        });
      }
    }
    return playbooks;
  } catch {
    return [];
  }
}

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
          (f) => f !== "SKILL.md" && !f.startsWith(".") && f !== "sites",
        );

        const sitePlaybooks = await discoverSitePlaybooks(skillDir);

        skills.push({
          name: meta.name || entry.name,
          description: meta.description || "",
          category: meta.category,
          directory: skillDir,
          resources,
          sitePlaybooks: sitePlaybooks.length > 0 ? sitePlaybooks : undefined,
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

/**
 * Build a domain -> site playbook lookup from all discovered skills.
 */
export function buildDomainIndex(
  skills: SkillMetadata[],
): Map<string, { skill: SkillMetadata; playbook: SitePlaybook }> {
  const index = new Map<string, { skill: SkillMetadata; playbook: SitePlaybook }>();
  for (const skill of skills) {
    for (const pb of skill.sitePlaybooks ?? []) {
      for (const domain of pb.domains) {
        index.set(domain.toLowerCase(), { skill, playbook: pb });
      }
    }
  }
  return index;
}
