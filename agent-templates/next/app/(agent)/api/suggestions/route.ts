import { generateText } from "ai";
import { getTaskModel } from "@agent/_config";
import { resolveModel } from "@/agent-core";
import { getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";

export async function POST(req: Request) {
  const { prompt, summary } = (await req.json()) as {
    prompt: string;
    summary: string;
  };

  try {
    const model = await resolveModel(hydrateModelConfig(getTaskModel("suggestions")), getProviderApiKeys());

    const { text } = await generateText({
      model,
      system: `You generate 3 short contextual follow-up suggestions based on a user's research task and what the agent found. Each should help the user dig deeper, compare, or take a different angle. Return exactly 3 suggestions, one per line. No numbering, no bullets, no quotes, no dashes, no extra text. Keep each under 50 characters.`,
      prompt: `Original task: ${prompt}\n\nWhat the agent found so far:\n${summary}`,
      maxOutputTokens: 200,
    });

    const suggestions = text
      .split("\n")
      .map((s) => s.replace(/^\d+[\.\)\-]\s*/, "").replace(/^[-•]\s*/, "").replace(/^["']|["']$/g, "").trim())
      .filter((s) => s.length > 0 && s.length < 80)
      .slice(0, 3);

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
