import { generateText } from "ai";
import { resolveModel } from "@agent-core";
import { getProviderKey } from "@agent/_lib/config/keys";
import { getBackgroundModel } from "@agent/_config";

export async function POST(req: Request) {
  const { description } = (await req.json()) as { description: string };

  if (!description?.trim()) {
    return Response.json({ error: "description is required" }, { status: 400 });
  }

  const apiKeys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) apiKeys[p] = k;
  }

  const modelConfig = getBackgroundModel();

  try {
    const model = await resolveModel(modelConfig, apiKeys);

    const { text } = await generateText({
      model,
      system: `You generate JSON schemas from natural language descriptions. Output ONLY valid JSON — no markdown, no explanation, no code fences.

Rules:
- Output a single JSON object that is a valid JSON Schema (type, properties, items, etc.)
- Use "type": "object" at the root with "properties"
- For lists/arrays use "type": "array" with "items"
- For nested objects, nest the schema
- Use appropriate types: string, number, boolean, array, object
- Add "required" arrays where fields seem mandatory
- Keep it minimal — don't add descriptions unless the field name is ambiguous`,
      prompt: description,
      maxOutputTokens: 2048,
    });

    const cleaned = text.replace(/^```json?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    const schema = JSON.parse(cleaned);

    return Response.json({ schema });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate schema" },
      { status: 500 },
    );
  }
}
