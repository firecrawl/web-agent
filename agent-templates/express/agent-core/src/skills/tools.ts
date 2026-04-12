import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import type { SkillMetadata, SitePlaybook } from "../types";
import { parseSkillBody } from "./parser";
import { buildDomainIndex } from "./discovery";

export function createSkillTools(
  skills: SkillMetadata[],
  customInstructions?: Record<string, string>,
) {
  const skillMap = new Map(skills.map((s) => [s.name, s]));
  const domainIndex = buildDomainIndex(skills);

  const catalogDescription = skills.length
    ? `Load a skill's full instructions. Available: ${skills.map((s) => `${s.name} (${s.description.slice(0, 60)})`).join("; ")}`
    : "Load a skill's instructions by name. No skills currently available.";

  // Build domain hint for the tool description
  const domainSkills = skills.filter((s) => s.sitePlaybooks?.length);
  const domainHint = domainSkills.length
    ? ` Site-specific playbooks auto-load via lookup_site_playbook for: ${domainSkills.flatMap((s) => s.sitePlaybooks!.map((p) => p.platform)).join(", ")}.`
    : "";

  return {
    load_skill: tool({
      description: catalogDescription + domainHint,
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
        let instructions = parseSkillBody(content);
        const custom = customInstructions?.[name];
        if (custom) {
          instructions += `\n\n## Custom Instructions\n${custom}`;
        }

        const sites = skill.sitePlaybooks?.map((p) => p.platform) ?? [];
        return {
          name: skill.name,
          instructions,
          ...(sites.length ? { available_site_playbooks: sites } : {}),
        };
      },
    }),

    lookup_site_playbook: tool({
      description:
        "Look up a site-specific navigation playbook by URL or domain. Returns detailed instructions for navigating that site (URL patterns, API endpoints, pagination, gotchas). Call this when you're about to scrape a site to check if a playbook exists.",
      inputSchema: z.object({
        url: z.string().describe("The URL or domain to look up"),
      }),
      execute: async ({ url }) => {
        let domain: string;
        try {
          domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
        } catch {
          domain = url.toLowerCase();
        }

        // Try exact match, then strip www., then check if domain ends with a known domain
        const stripped = domain.replace(/^www\./, "");
        const match =
          domainIndex.get(domain) ??
          domainIndex.get(stripped) ??
          [...domainIndex.entries()].find(([d]) => domain.endsWith(d) || stripped.endsWith(d))?.[1];

        if (!match) {
          return { found: false, message: `No site playbook for ${domain}` };
        }

        const content = await fs.readFile(match.playbook.filePath, "utf-8");
        const body = parseSkillBody(content);

        return {
          found: true,
          platform: match.playbook.platform,
          skill: match.skill.name,
          playbook: body,
        };
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
