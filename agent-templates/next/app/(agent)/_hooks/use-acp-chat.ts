"use client";

import { useState, useRef, useCallback } from "react";
import type { UIMessage } from "ai";

interface ACPEvent {
  type: "text" | "tool_call" | "tool_update" | "plan" | "usage" | "done" | "error";
  text?: string;
  toolCall?: { id: string; title: string; status: string; rawInput?: unknown; rawOutput?: unknown };
  plan?: { content: string; status: string }[];
  usage?: { size: number; used: number; cost?: { amount: number; currency: string } };
  error?: string;
}

export function useACPChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "submitted">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const msgIdCounter = useRef(0);

  const sendMessage = useCallback(async (opts: { text: string; bin: string; systemPrompt?: string }) => {
    const userMsgId = `acp-user-${++msgIdCounter.current}`;
    const assistantMsgId = `acp-assistant-${++msgIdCounter.current}`;

    const userMsg: UIMessage = {
      id: userMsgId,
      role: "user",
      parts: [{ type: "text", text: opts.text }],
    };

    // Running text accumulator
    let textAccum = "";
    // Tool calls accumulator
    const toolCalls = new Map<string, { toolName: string; state: string; input: unknown; output: unknown }>();

    setMessages((prev) => [...prev, userMsg]);
    setStatus("submitted");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/acp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bin: opts.bin,
          prompt: opts.text,
          systemPrompt: opts.systemPrompt,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`ACP request failed: ${res.status}`);
      }

      setStatus("streaming");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          let event: ACPEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          switch (event.type) {
            case "text":
              textAccum += event.text ?? "";
              break;
            case "tool_call":
              if (event.toolCall) {
                toolCalls.set(event.toolCall.id, {
                  toolName: event.toolCall.title,
                  state: "call",
                  input: event.toolCall.rawInput,
                  output: event.toolCall.rawOutput,
                });
              }
              break;
            case "tool_update":
              if (event.toolCall) {
                const existing = toolCalls.get(event.toolCall.id);
                if (existing) {
                  const isDone = event.toolCall.status === "completed" || event.toolCall.status === "errored";
                  existing.state = isDone ? "output-available" : "call";
                  existing.output = event.toolCall.rawOutput ?? existing.output;
                  existing.input = event.toolCall.rawInput ?? existing.input;
                  if (event.toolCall.title) existing.toolName = event.toolCall.title;
                }
              }
              break;
            case "done":
            case "error":
              if (event.error) {
                textAccum += `\n\nError: ${event.error}`;
              }
              break;
          }

          // Rebuild assistant message parts from accumulated state
          const parts: UIMessage["parts"] = [];

          if (textAccum) {
            parts.push({ type: "text" as const, text: textAccum });
          }

          for (const [id, tc] of toolCalls) {
            // Normalize tool name for part type (no spaces, lowercase)
            const normalizedName = tc.toolName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
            parts.push({
              type: `tool-${normalizedName}` as any,
              toolName: tc.toolName,
              toolCallId: id,
              state: tc.state,
              input: tc.input,
              args: tc.input,
              output: tc.output,
              result: tc.output,
            } as any);
          }

          if (parts.length > 0) {
            const assistantMsg: UIMessage = {
              id: assistantMsgId,
              role: "assistant",
              parts,
            };
            setMessages((prev) => {
              const without = prev.filter((m) => m.id !== assistantMsgId);
              return [...without, assistantMsg];
            });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const parts: UIMessage["parts"] = [];
        if (textAccum) parts.push({ type: "text", text: textAccum });
        parts.push({ type: "text", text: `\n\nError: ${(err as Error).message}` });
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== assistantMsgId);
          return [...without, { id: assistantMsgId, role: "assistant" as const, parts }];
        });
      }
    } finally {
      setStatus("idle");
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return { messages, sendMessage, status, stop };
}
