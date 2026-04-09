import matter from "gray-matter";

export interface SkillFrontmatter {
  name: string;
  description: string;
  category?: string;
  model?: string;
  domains?: string[];
  platform?: string;
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const { data } = matter(content);
  return {
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
    category: typeof data.category === "string" ? data.category : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    domains: Array.isArray(data.domains) ? data.domains.map(String) : undefined,
    platform: typeof data.platform === "string" ? data.platform : undefined,
  };
}

export function parseSkillBody(content: string): string {
  const { content: body } = matter(content);
  return body.trim();
}

export interface SkillValidationResult {
  valid: boolean;
  name: string;
  slug: string;
  description: string;
  errors: string[];
}

export function validateSkillContent(content: string): SkillValidationResult {
  const meta = parseSkillFrontmatter(content);
  const errors: string[] = [];

  if (!meta.name) errors.push("Missing required field: name");
  if (!meta.description) errors.push("Missing required field: description");

  const slug = (meta.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (meta.name && !slug) errors.push("Name produces empty slug");

  const body = parseSkillBody(content);
  if (!body) errors.push("Empty body (no content after frontmatter)");

  return { valid: errors.length === 0, name: meta.name, slug, description: meta.description, errors };
}
