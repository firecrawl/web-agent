import { getFirecrawlKey } from "@/lib/config/keys";

export const maxDuration = 300;

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v2";

/**
 * POST /api/firecrawl-agent
 *
 * Proxy to Firecrawl's /agent endpoint (Spark models).
 * Starts the job and polls until completion, then returns the result.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { prompt, schema, urls, model = "spark-1-mini", maxCredits } = body as {
    prompt: string;
    schema?: Record<string, unknown>;
    urls?: string[];
    model?: string;
    maxCredits?: number;
  };

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const apiKey = getFirecrawlKey();
  if (!apiKey) {
    return Response.json(
      { error: "FIRECRAWL_API_KEY is not configured. Add it in Settings." },
      { status: 500 },
    );
  }

  try {
    // Start the agent job
    const startResp = await fetch(`${FIRECRAWL_API_BASE}/agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model,
        ...(schema && { schema }),
        ...(urls?.length && { urls }),
        ...(maxCredits && { maxCredits }),
      }),
    });

    if (!startResp.ok) {
      const err = await startResp.text();
      return Response.json(
        { error: `Firecrawl API error: ${err}` },
        { status: startResp.status },
      );
    }

    const startData = await startResp.json();

    // If already completed (unlikely), return immediately
    if (startData.status === "completed") {
      return Response.json(startData);
    }

    // Poll for completion
    const jobId = startData.id;
    if (!jobId) {
      return Response.json(startData);
    }

    const maxAttempts = 120; // 4 minutes at 2s interval
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusResp = await fetch(`${FIRECRAWL_API_BASE}/agent/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!statusResp.ok) continue;

      const statusData = await statusResp.json();

      if (statusData.status === "completed" || statusData.status === "failed" || statusData.status === "cancelled") {
        return Response.json(statusData);
      }
    }

    return Response.json(
      { error: "Agent job timed out after 4 minutes", status: "timeout" },
      { status: 408 },
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
