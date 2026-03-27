import matter from "gray-matter";

export interface SkillFrontmatter {
  name: string;
  description: string;
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const { data } = matter(content);
  return {
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
  };
}

export function parseSkillBody(content: string): string {
  const { content: body } = matter(content);
  return body.trim();
}
