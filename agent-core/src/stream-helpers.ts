/**
 * Stream helpers that work with ANY Deep Agent (or LangGraph runnable).
 * These are pure functions — not tied to our wrapper — so you can use them
 * with `createDeepAgent` directly, not just `createFirecrawlAgent`.
 */

type StreamInput = { messages: Array<{ role: string; content: string }> };

interface StreamableAgent {
  stream(
    input: StreamInput,
    options?: { streamMode?: string | string[]; subgraphs?: boolean },
  ): Promise<AsyncIterable<any>>;
}

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool-call"; toolName: string; input: unknown }
  | { type: "tool-result"; toolName: string; output: unknown }
  | { type: "done" }
  | { type: "error"; error: string };

/**
 * Stream a Deep Agent run as a normalized event async-generator.
 * Use this when you want a simple event stream without dealing with
 * LangGraph's [mode, chunk] tuples directly.
 */
export async function* streamEvents(
  agent: StreamableAgent,
  input: StreamInput,
): AsyncGenerator<AgentEvent> {
  try {
    for await (const [mode, chunk] of await agent.stream(input, {
      streamMode: ["messages", "updates"],
    })) {
      if (mode === "messages") {
        const [msg] = chunk as [any];
        if (msg?.text) yield { type: "text", content: msg.text };
        for (const tc of msg?.tool_calls ?? []) {
          yield { type: "tool-call", toolName: tc.name, input: tc.args };
        }
      } else if (mode === "updates") {
        const update = chunk as Record<string, any>;
        for (const node of Object.values(update)) {
          for (const m of (node as any)?.messages ?? []) {
            if (m?.type === "tool" || m?._getType?.() === "tool") {
              yield { type: "tool-result", toolName: m.name, output: m.content };
            }
          }
        }
      }
    }
    yield { type: "done" };
  } catch (err) {
    yield { type: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Web Response with SSE stream. Works in Next.js, Hono, Bun, edge-compatible.
 */
export function toResponse(agent: StreamableAgent, input: StreamInput): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of streamEvents(agent, input)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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

/**
 * Pipe SSE events to an Express/Node response object.
 */
export async function toSSE(
  agent: StreamableAgent,
  input: StreamInput,
  res: { setHeader(k: string, v: string): void; write(c: string): void; end(): void },
): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  for await (const event of streamEvents(agent, input)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}
