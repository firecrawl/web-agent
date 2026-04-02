import fs from "fs/promises";
import path from "path";
import { parseSkillBody } from "@agent-core";

const SKILLS_DIR = path.join(process.cwd(), "agent-core", "src", "skills", "definitions");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const skillFile = path.join(SKILLS_DIR, name, "SKILL.md");

  try {
    const raw = await fs.readFile(skillFile, "utf-8");
    const content = parseSkillBody(raw);
    return Response.json({ name, content });
  } catch {
    return Response.json({ error: "Skill not found" }, { status: 404 });
  }
}
