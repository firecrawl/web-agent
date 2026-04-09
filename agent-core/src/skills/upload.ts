import fs from "fs/promises";
import path from "path";
import { validateSkillContent } from "./parser";

export interface SkillUploadFile {
  name: string;
  content: string;
}

export interface SkillUploadResult {
  file: string;
  status: "created" | "overwritten" | "conflict" | "error";
  skill?: string;
  path?: string;
  error?: string;
}

export async function uploadSkills(
  files: SkillUploadFile[],
  skillsDir: string,
  overwrite = false,
): Promise<SkillUploadResult[]> {
  const results: SkillUploadResult[] = [];

  for (const file of files) {
    const validation = validateSkillContent(file.content);
    if (!validation.valid) {
      results.push({ file: file.name, status: "error", error: validation.errors.join("; ") });
      continue;
    }

    const dir = path.join(skillsDir, validation.slug);
    const skillFile = path.join(dir, "SKILL.md");

    let exists = false;
    try {
      await fs.access(skillFile);
      exists = true;
    } catch {
      // doesn't exist
    }

    if (exists && !overwrite) {
      results.push({
        file: file.name,
        status: "conflict",
        skill: validation.slug,
        path: `skills/definitions/${validation.slug}/SKILL.md`,
        error: `Skill "${validation.slug}" already exists. Set overwrite=true to replace.`,
      });
      continue;
    }

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(skillFile, file.content, "utf-8");
      results.push({
        file: file.name,
        status: exists ? "overwritten" : "created",
        skill: validation.slug,
        path: `skills/definitions/${validation.slug}/SKILL.md`,
      });
    } catch (err) {
      results.push({
        file: file.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
