import { generateText } from "ai";
import { getTaskModel } from "@/config";
import { resolveModel } from "@agent-core";
import { getProviderKey } from "@/lib/config/keys";

function getApiKeys() {
  const keys: Record<string, string> = {};
  for (const p of ["anthropic", "openai", "google", "gateway"] as const) {
    const k = getProviderKey(p);
    if (k) keys[p] = k;
  }
  return keys;
}

export async function POST(req: Request) {
  const { prompt, summary } = (await req.json()) as {
    prompt: string;
    summary: string;
  };

  try {
    const model = await resolveModel(getTaskModel("suggestions"), getApiKeys());

    const { text } = await generateText({
      model,
      system: `You generate 3-5 short contextual follow-up questions based on a user's research task and what the agent found. Each question should help the user dig deeper, compare, or take a different angle. Return exactly 5 questions, one per line, no numbering, no quotes, no extra text. Keep each under 60 characters.`,
      prompt: `Original task: ${prompt}\n\nWhat the agent found so far:\n${summary}`,
      maxOutputTokens: 200,
    });

    const suggestions = text
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 80)
      .slice(0, 5);

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
