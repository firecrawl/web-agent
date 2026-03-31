import { discoverSkills } from "@agent-core";

export async function GET() {
  const skills = await discoverSkills();
  return Response.json(
    skills.map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category ?? "Other",
      resources: s.resources,
    })),
  );
}
