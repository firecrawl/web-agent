import { runACPAgent } from "@agent/_lib/agents/acp";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { bin, prompt, systemPrompt } = (await req.json()) as {
    bin: string;
    prompt: string;
    systemPrompt?: string;
  };

  if (!bin || !prompt) {
    return Response.json({ error: "bin and prompt are required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runACPAgent({ bin, prompt, systemPrompt })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === "done" || event.type === "error") break;
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
