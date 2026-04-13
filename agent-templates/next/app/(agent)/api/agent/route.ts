import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { AIMessage, ToolMessage, type BaseMessage, isAIMessage } from "@langchain/core/messages";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { createAgent } from "@/agent-core";
import type { AgentConfig } from "@/agent-core";
import { getFirecrawlKey, getProviderApiKeys, hydrateModelConfig } from "@agent/_lib/config/keys";
import { config as globalConfig } from "@agent/_config";
import { loadAppSections } from "@/prompts/loader";

/**
 * Anthropic rejects tool_use blocks whose `input` is missing (required field).
 * On turn 2+ the UIMessage → LangChain conversion can yield AIMessage.tool_calls
 * with undefined args (happens when a prior stream was interrupted mid-tool-call
 * or when the bridge can't reconstruct args from persisted UI state). Backfill
 * args to {} and drop any tool_calls / ToolMessages that are orphaned.
 *
 * See: https://docs.langchain.com/oss/javascript/langchain/errors/INVALID_TOOL_RESULTS/
 */
function sanitizeToolCallHistory(messages: BaseMessage[]): BaseMessage[] {
  const repaired = messages.map((m) => {
    if (isAIMessage(m) && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const fixed = m.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        type: "tool_call" as const,
        args: tc.args ?? {},
      }));
      return new AIMessage({
        content: m.content ?? "",
        tool_calls: fixed,
        additional_kwargs: m.additional_kwargs,
        response_metadata: m.response_metadata,
        id: m.id,
      });
    }
    return m;
  });

  // Drop orphan ToolMessages (no matching tool_call) and AIMessages whose
  // tool_calls have no paired ToolMessage — Anthropic validates 1:1 pairing.
  const aiCallIds = new Set<string>();
  for (const m of repaired) {
    if (isAIMessage(m) && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) if (tc.id) aiCallIds.add(tc.id);
    }
  }
  const toolMsgIds = new Set<string>();
  for (const m of repaired) {
    if (m instanceof ToolMessage && m.tool_call_id) toolMsgIds.add(m.tool_call_id);
  }

  return repaired.filter((m) => {
    if (m instanceof ToolMessage) return !m.tool_call_id || aiCallIds.has(m.tool_call_id);
    if (isAIMessage(m) && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      return m.tool_calls.every((tc) => !tc.id || toolMsgIds.has(tc.id));
    }
    return true;
  });
}

export const maxDuration = 300;

interface InteractSessionInfo {
  scrapeId: string;
  liveViewUrl: string | null;
  interactiveLiveViewUrl: string | null;
  url: string;
}

export async function POST(req: Request) {
  const { messages, config } = (await req.json()) as {
    messages: UIMessage[];
    config: AgentConfig;
  };

  const firecrawlApiKey = getFirecrawlKey();
  if (!firecrawlApiKey) {
    return new Response(
      JSON.stringify({
        error:
          "FIRECRAWL_API_KEY is missing. Set it in .env.local (or your host's env), or paste it in Settings — then restart dev if you edited the file.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "No messages in request." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const t0 = performance.now();
  const timings: Record<string, number> = {};

  try {
    const tPromptStart = performance.now();
    const appSections = await loadAppSections({
      hasSchema: !!(config.schema || config.columns),
      schema: config.schema,
      columns: config.columns,
    });
    timings.loadPrompts = performance.now() - tPromptStart;

    const tAgentStart = performance.now();
    const modelConf = hydrateModelConfig(config.model);
    const subAgentConf = config.subAgentModel ? hydrateModelConfig(config.subAgentModel) : undefined;

    // Collect interact session info as the Firecrawl SDK reports it. Bound
    // per-request; flushed to the client via `data-interact-liveview` parts
    // inside the createUIMessageStream execute() below.
    const interactSessions: Record<string, InteractSessionInfo> = {};
    const onInteractSessionStart = (info: InteractSessionInfo) => {
      interactSessions[info.scrapeId] = info;
    };

    // Fresh agent per request so its interact tool instance(s) carry the
    // request-scoped onSessionStart callback. Previously we cached but the
    // cached agent's callbacks point at stale writers.
    const agent = createAgent({
      firecrawlApiKey,
      firecrawlOptions: {
        bash: true,
        interactAutoStart: true,
        onInteractSessionStart,
      },
      model: modelConf,
      subAgentModel: subAgentConf,
      apiKeys: getProviderApiKeys(),
      maxSteps: config.maxSteps,
      maxWorkers: globalConfig.maxWorkers,
      workerMaxSteps: globalConfig.workerMaxSteps,
      appSections,
    });

    // Deep Agent = LangGraph runnable with .stream(input, { streamMode }).
    const rawAgent = await agent.createRawAgent({
      prompt: config.prompt,
      urls: config.urls,
      schema: config.schema,
      columns: config.columns,
      uploads: config.uploads,
      skills: config.skills,
      skillInstructions: config.skillInstructions,
      subAgents: config.subAgents,
    });
    timings.buildAgent = performance.now() - tAgentStart;

    // AI SDK UIMessages → LangChain BaseMessages → sanitize → feed into graph.
    const tMsgStart = performance.now();
    const langchainMessages = sanitizeToolCallHistory(await toBaseMessages(messages));
    timings.convertMessages = performance.now() - tMsgStart;

    const tStreamStart = performance.now();
    // Need BOTH "values" and "messages":
    // - "messages" streams AIMessageChunk token deltas (live typing effect)
    // - "values" is what causes the bridge (@ai-sdk/langchain) to emit
    //   `tool-output-available` / `tool-input-available` events at the end of
    //   each graph step — without it, tool calls never transition to the
    //   "complete" state in the UI, so no tiles render at all.
    //
    // The duplicate-text stutter we saw with `["values", "messages"]` earlier
    // is now dampened by our frontend dedupe on `parts` (the AI SDK useChat
    // merges chunks by toolCallId, and text duplication from values ends up
    // appending to the same text part, not creating a new one).
    //
    // `runState` is a per-request object the agent-core tool shim reads off
    // `config.configurable`. Initially `dataCollected: false`; flips to true
    // when a data-gathering tool returns non-empty output. formatOutput refuses
    // to run while false — prevents the "format called prematurely with stub
    // data" failure mode at the tool boundary rather than via prompt rules.
    const runState = { dataCollected: false };
    // `subgraphs: true` makes sub-agent (task tool) inner events stream through
    // the parent stream. Without it, only the task tool's final string result
    // bubbles up — and the UI has no way to show what the sub-agent did. The
    // tradeoff: the stream now yields `[namespace, mode, data]` 3-tuples
    // instead of `[mode, data]`, which the @ai-sdk/langchain bridge can't
    // parse, so we unwrap them below before handing off to the bridge.
    const rawLangGraphStream = await rawAgent.stream(
      { messages: langchainMessages },
      { streamMode: ["values", "messages"], subgraphs: true, configurable: { runState } },
    );

    // Namespace-aware stream processing.
    //
    // LangGraph's `subgraphs: true` gives us 3-tuples `[namespace, mode, data]`
    // where `namespace[0]` is a graph-internal UUID like `"tools:<uuid>"` —
    // this is NOT the LLM's tool_call_id (`toolu_*`). The task tool_call_id
    // that the frontend tracks only lives in ROOT-namespace AIMessageChunks.
    //
    // So we build the map in two steps:
    //  1. Watch root-namespace messages (2-tuples) for `name === "task"` tool
    //     calls and queue their real `toolu_*` IDs in arrival order.
    //  2. When a sub-namespace appears for the first time, pop the next
    //     unclaimed task from the queue and remember `nsKey → parentToolCallId`.
    //     Every subsequent tool call seen in that sub-namespace gets mapped
    //     to that parent.

    function collectToolCalls(data: unknown): Array<{ id: string; name: string }> {
      const out: Array<{ id: string; name: string }> = [];
      if (!data) return out;
      const msg = Array.isArray(data) ? data[0] : data;
      const anyMsg = msg as { tool_calls?: Array<{ id?: string; name?: string }>; tool_call_chunks?: Array<{ id?: string; name?: string }> };
      for (const tc of anyMsg?.tool_calls ?? []) if (tc.id && tc.name) out.push({ id: tc.id, name: tc.name });
      for (const tc of anyMsg?.tool_call_chunks ?? []) if (tc.id && tc.name) out.push({ id: tc.id, name: tc.name });
      const state = data as { messages?: Array<{ tool_calls?: Array<{ id?: string; name?: string }> }> };
      for (const m of state?.messages ?? []) {
        for (const tc of m.tool_calls ?? []) if (tc.id && tc.name) out.push({ id: tc.id, name: tc.name });
      }
      return out;
    }

    // Pull out assistant message ids (used to attribute text parts back to
    // the sub-agent that emitted them).
    function collectMessageIds(data: unknown): string[] {
      const out: string[] = [];
      if (!data) return out;
      const msg = Array.isArray(data) ? data[0] : data;
      const anyMsg = msg as { id?: string };
      if (typeof anyMsg?.id === "string") out.push(anyMsg.id);
      const state = data as { messages?: Array<{ id?: string }> };
      for (const m of state?.messages ?? []) if (typeof m.id === "string") out.push(m.id);
      return out;
    }

    // One map carries both kinds of entries to the client:
    //   - `<toolu_xxx>`        → parent task toolu_*   (tool call attribution)
    //   - `msg:<message_id>`   → parent task toolu_*   (text part attribution; legacy)
    const toolCallParent: Record<string, string> = {};
    const seenNamespaces = new Set<string>();
    const nsToParent = new Map<string, string>();          // sub-ns → claimed parent toolu_*
    const nsChildren = new Map<string, Set<string>>();     // sub-ns → child tool_call_ids seen so far
    const nsMessageIds = new Map<string, Set<string>>();   // sub-ns → message_ids seen so far
    const nsPendingText = new Map<string, string>();       // sub-ns → text seen BEFORE parent was claimed
    const pendingNamespaces: string[] = [];                // FIFO of sub-ns keys awaiting a parent
    const pendingTasks: string[] = [];                     // FIFO of root task tool_call_ids awaiting a sub-ns
    const knownTasks = new Set<string>();                  // dedupe root task ids across repeated emissions

    // Accumulate sub-agent text by parent task id — authoritative text stream
    // for each task, bypassing the bridge's text-part attribution entirely.
    const subagentText: Record<string, string> = {};

    // Extract text content out of an AIMessageChunk-shaped value. LangChain's
    // content can be a plain string or an array of content blocks.
    function extractText(msg: unknown): string {
      if (!msg || typeof msg !== "object") return "";
      const content = (msg as { content?: unknown }).content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        let out = "";
        for (const block of content) {
          if (typeof block === "string") out += block;
          else if (block && typeof block === "object") {
            const b = block as { type?: string; text?: string };
            if (b.type === "text" && typeof b.text === "string") out += b.text;
          }
        }
        return out;
      }
      return "";
    }

    // Return a shallow clone of the messages-mode payload `[msg, metadata]`
    // with the text content stripped off the AIMessageChunk, so the bridge
    // won't emit duplicate text-delta chunks for sub-agent text we've already
    // captured ourselves.
    function stripTextFromMsgPayload(data: unknown): unknown {
      if (!Array.isArray(data) || data.length === 0) return data;
      const [msg, ...rest] = data as [unknown, ...unknown[]];
      if (!msg || typeof msg !== "object") return data;
      const withEmptyContent = Object.assign(Object.create(Object.getPrototypeOf(msg)), msg, { content: "" });
      return [withEmptyContent, ...rest];
    }

    // Match pending namespaces with pending tasks FIFO-style. Retroactively
    // maps all children that were seen in that namespace BEFORE the parent
    // was known.
    function tryAssign() {
      while (pendingNamespaces.length > 0 && pendingTasks.length > 0) {
        const nsKey = pendingNamespaces.shift()!;
        const parentId = pendingTasks.shift()!;
        nsToParent.set(nsKey, parentId);
        console.log(`[agent] ns-claim ${nsKey} → parent=${parentId}`);
        const kids = nsChildren.get(nsKey);
        if (kids) {
          for (const childId of kids) {
            if (!toolCallParent[childId]) {
              toolCallParent[childId] = parentId;
              console.log(`[agent] map (retro) child=${childId} parent=${parentId}`);
            }
          }
        }
        const msgs = nsMessageIds.get(nsKey);
        if (msgs) {
          for (const msgId of msgs) {
            const key = `msg:${msgId}`;
            if (!toolCallParent[key]) toolCallParent[key] = parentId;
          }
        }
        // Retroactive text: any narration we captured under this ns before
        // the parent was claimed gets stitched into the parent's stream now.
        const buffered = nsPendingText.get(nsKey);
        if (buffered) {
          subagentText[parentId] = (subagentText[parentId] ?? "") + buffered;
          nsPendingText.delete(nsKey);
        }
      }
    }

    // A namespace represents a sub-agent run iff any element starts with
    // "tools:" — that's how Deep Agents/LangGraph tag a spawned subgraph.
    // Other prefixes like "model_request:" are internal nodes that still
    // belong to whichever graph they're in.
    function subAgentNsKey(ns: unknown): string {
      if (!Array.isArray(ns)) return "";
      for (const seg of ns) {
        if (typeof seg === "string" && seg.startsWith("tools:")) return seg;
      }
      return "";
    }

    async function* stripNamespaceAndMap(src: AsyncIterable<unknown>) {
      for await (const chunk of src) {
        // With subgraphs: true, every event is `[namespace, mode, data]` —
        // root events have namespace `[]` (length 0) or only internal nodes
        // like `["model_request:…"]`.
        if (Array.isArray(chunk) && chunk.length === 3) {
          const [ns, mode, data] = chunk;
          if (!seenNamespaces.has(JSON.stringify(ns))) {
            seenNamespaces.add(JSON.stringify(ns));
            console.log(`[agent] ns=${JSON.stringify(ns)} mode=${String(mode)}`);
          }
          const nsKey = subAgentNsKey(ns);

          if (nsKey) {
            // We're inside a sub-agent graph.
            if (!nsChildren.has(nsKey)) {
              nsChildren.set(nsKey, new Set());
              nsMessageIds.set(nsKey, new Set());
              if (!nsToParent.has(nsKey)) pendingNamespaces.push(nsKey);
              tryAssign();
            }
            const kids = nsChildren.get(nsKey)!;
            for (const tc of collectToolCalls(data)) kids.add(tc.id);
            const msgs = nsMessageIds.get(nsKey)!;
            for (const id of collectMessageIds(data)) msgs.add(id);

            const parentId = nsToParent.get(nsKey);
            if (parentId) {
              for (const tc of collectToolCalls(data)) {
                if (!toolCallParent[tc.id]) {
                  toolCallParent[tc.id] = parentId;
                }
              }
              for (const id of collectMessageIds(data)) {
                const key = `msg:${id}`;
                if (!toolCallParent[key]) toolCallParent[key] = parentId;
              }
            }

            // Capture sub-agent text and strip it from the payload we forward
            // to the bridge, so it never shows up in the orchestrator's main
            // thread. The text will be rendered inside the sub-agent's tile
            // via `data-subagent-text` (emitted from the merge loop below).
            //
            // IMPORTANT: we only capture text from chunks that ALSO have tool
            // calls — i.e. reasoning that precedes a tool invocation. The
            // sub-agent's FINAL message (no tool calls) is its structured
            // JSON reply to the orchestrator. That's the output, not a
            // thought — we still strip it from the bridge so it doesn't leak
            // into the orchestrator thread, but we don't add it to the
            // "train of thought" stream.
            if (mode === "messages" && Array.isArray(data)) {
              const msg = data[0] as { tool_calls?: unknown[]; tool_call_chunks?: unknown[] };
              const text = extractText(msg);
              const hasToolActivity = (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0)
                || (Array.isArray(msg?.tool_call_chunks) && msg.tool_call_chunks.length > 0);
              if (text) {
                if (hasToolActivity) {
                  if (parentId) {
                    subagentText[parentId] = (subagentText[parentId] ?? "") + text;
                  } else {
                    nsPendingText.set(nsKey, (nsPendingText.get(nsKey) ?? "") + text);
                  }
                }
                // Regardless of tool activity, strip text from the bridge
                // payload so it never reaches the orchestrator's UI thread.
                yield [mode, stripTextFromMsgPayload(data)];
                continue;
              }
            }
          } else {
            // Root-graph event — this is where orchestrator task tool_calls
            // actually live. Queue them for sub-ns matching.
            for (const tc of collectToolCalls(data)) {
              if (tc.name !== "task") continue;
              if (knownTasks.has(tc.id)) continue;
              let alreadyAssigned = false;
              for (const v of nsToParent.values()) { if (v === tc.id) { alreadyAssigned = true; break; } }
              if (alreadyAssigned) continue;
              knownTasks.add(tc.id);
              pendingTasks.push(tc.id);
              console.log(`[agent] queued task id=${tc.id}`);
            }
            tryAssign();
          }

          yield [mode, data];
        } else {
          yield chunk;
        }
      }
    }
    const stream = stripNamespaceAndMap(rawLangGraphStream as AsyncIterable<unknown>) as unknown as ReadableStream;
    timings.graphStreamInit = performance.now() - tStreamStart;

    console.log(`[agent] boot ${(performance.now() - t0).toFixed(0)}ms  prompts=${timings.loadPrompts.toFixed(0)}  buildAgent=${timings.buildAgent.toFixed(0)}  convertMsgs=${timings.convertMessages.toFixed(0)}  graphInit=${timings.graphStreamInit.toFixed(0)}  msgsIn=${langchainMessages.length}`);

    // Merge the standard UIMessage stream (text, tool parts) with our own
    // `data-subagent-map` parts so the UI can nest tool calls under their
    // parent task even during streaming.
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          const mainStream = toUIMessageStream(stream);
          // Consume and forward main stream chunks; periodically flush mapping.
          const reader = mainStream.getReader();
          let lastMapSize = 0;
          const lastTextLen: Record<string, number> = {};
          const emittedSessions: Record<string, string> = {}; // scrapeId → last liveViewUrl emitted

          const flushInteractSessions = () => {
            for (const [scrapeId, info] of Object.entries(interactSessions)) {
              if (!info.liveViewUrl) continue;
              if (emittedSessions[scrapeId] === info.liveViewUrl) continue;
              writer.write({
                type: "data-interact-liveview",
                id: `interact-liveview:${scrapeId}`,
                data: {
                  scrapeId: info.scrapeId,
                  liveViewUrl: info.liveViewUrl,
                  interactiveLiveViewUrl: info.interactiveLiveViewUrl,
                  url: info.url,
                },
              } as never);
              emittedSessions[scrapeId] = info.liveViewUrl;
            }
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              writer.write(value);
              // Flush the id → parent mapping when it grows.
              const size = Object.keys(toolCallParent).length;
              if (size > lastMapSize) {
                writer.write({ type: "data-subagent-map", id: "subagent-map", data: { ...toolCallParent } } as never);
                lastMapSize = size;
              }
              // Flush sub-agent text reducers — one data part per parent,
              // re-emitted each time its buffer grows. AI SDK v6 keeps the
              // latest `data-*` with the same `id` in the UIMessage, so the
              // client always has the authoritative accumulated text.
              for (const [parentId, text] of Object.entries(subagentText)) {
                if ((lastTextLen[parentId] ?? 0) !== text.length) {
                  writer.write({
                    type: "data-subagent-text",
                    id: `subagent-text:${parentId}`,
                    data: { parentId, text },
                  } as never);
                  lastTextLen[parentId] = text.length;
                }
              }
              // Flush any new interact session live-view URLs captured via
              // the onSessionStart callback. Each scrapeId gets its own
              // stable `id` so the UIMessage reducer replaces-in-place.
              flushInteractSessions();
            }
            // Final flush.
            if (Object.keys(toolCallParent).length > lastMapSize) {
              writer.write({ type: "data-subagent-map", id: "subagent-map", data: { ...toolCallParent } } as never);
            }
            for (const [parentId, text] of Object.entries(subagentText)) {
              if ((lastTextLen[parentId] ?? 0) !== text.length) {
                writer.write({
                  type: "data-subagent-text",
                  id: `subagent-text:${parentId}`,
                  data: { parentId, text },
                } as never);
              }
            }
            flushInteractSessions();
            console.log(`[agent] stream done. map=${Object.keys(toolCallParent).length} subagent-texts=${Object.keys(subagentText).length} interact-sessions=${Object.keys(interactSessions).length}`);
          } finally {
            reader.releaseLock();
          }
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
