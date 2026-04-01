import { spawn, type ChildProcess } from "child_process";
import { Writable, Readable } from "stream";
import { execSync } from "child_process";

interface ACPAgent {
  name: string;
  bin: string;
  displayName: string;
}

const KNOWN_AGENTS: ACPAgent[] = [
  { name: "claude", bin: "claude-agent-acp", displayName: "Claude Code" },
  { name: "codex", bin: "codex-acp", displayName: "Codex" },
];

function isBinAvailable(bin: string): boolean {
  try {
    execSync(`which ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function detectACPAgents() {
  return KNOWN_AGENTS.map((a) => ({
    ...a,
    available: isBinAvailable(a.bin),
  }));
}

export interface ACPEvent {
  type: "text" | "tool_call" | "tool_update" | "plan" | "usage" | "done" | "error";
  text?: string;
  toolCall?: { id: string; title: string; status: string; rawInput?: unknown; rawOutput?: unknown };
  plan?: { content: string; status: string }[];
  usage?: { size: number; used: number; cost?: { amount: number; currency: string } };
  error?: string;
}

export async function* runACPAgent(opts: {
  bin: string;
  prompt: string;
  systemPrompt?: string;
  cwd?: string;
}): AsyncGenerator<ACPEvent> {
  const acp = await import("@agentclientprotocol/sdk");

  const agentProcess: ChildProcess = spawn(opts.bin, [], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: opts.cwd ?? process.cwd(),
  });

  agentProcess.stderr?.resume();

  const queue: ACPEvent[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  function push(event: ACPEvent) {
    queue.push(event);
    if (resolve) {
      resolve();
      resolve = null;
    }
  }

  agentProcess.on("error", (err) => {
    push({
      type: "error",
      error: (err as NodeJS.ErrnoException).code === "ENOENT"
        ? `Agent "${opts.bin}" not found. Is it installed and on your PATH?`
        : err.message,
    });
    done = true;
  });

  agentProcess.on("exit", () => {
    if (!done) {
      push({ type: "done" });
      done = true;
    }
  });

  try {
    const input = Writable.toWeb(agentProcess.stdin!) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(agentProcess.stdout!) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);

    const client = {
      async requestPermission(params: { options: { optionId: string; kind: string }[] }) {
        const allow = params.options.find(
          (o) => o.kind === "allow_once" || o.kind === "allow_always",
        );
        return {
          outcome: {
            outcome: "selected",
            optionId: allow?.optionId ?? params.options[0].optionId,
          },
        };
      },

      async sessionUpdate(params: { sessionId: string; update: Record<string, unknown> }) {
        const update = params.update;
        const updateType = update.sessionUpdate as string;

        switch (updateType) {
          case "agent_message_chunk":
          case "user_message_chunk": {
            const content = update.content as { type: string; text?: string } | undefined;
            if (content?.type === "text" && content.text) {
              push({ type: "text", text: content.text });
            }
            break;
          }

          case "tool_call": {
            push({
              type: "tool_call",
              toolCall: {
                id: update.toolCallId as string,
                title: (update.title as string) ?? "tool",
                status: (update.status as string) ?? "pending",
                rawInput: update.rawInput,
                rawOutput: update.rawOutput,
              },
            });
            break;
          }

          case "tool_call_update": {
            const status = update.status as string | undefined;
            push({
              type: "tool_update",
              toolCall: {
                id: update.toolCallId as string,
                title: (update.title as string) ?? "",
                status: status ?? "unknown",
                rawInput: update.rawInput,
                rawOutput: update.rawOutput,
              },
            });
            break;
          }

          case "plan": {
            const entries = update.entries as { content: string; status: string }[] | undefined;
            if (entries) {
              push({
                type: "plan",
                plan: entries.map((e) => ({ content: e.content, status: e.status })),
              });
            }
            break;
          }

          case "usage_update": {
            const usage = update.usage as { size?: number; used?: number; cost?: { amount: number; currency: string } } | undefined;
            if (usage) {
              push({
                type: "usage",
                usage: {
                  size: usage.size ?? 0,
                  used: usage.used ?? 0,
                  cost: usage.cost,
                },
              });
            }
            break;
          }
        }
      },

      async writeTextFile(params: { path: string; content: string }) {
        const fs = await import("fs");
        const path = await import("path");
        const dir = path.dirname(params.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(params.path, params.content, "utf-8");
        return {};
      },

      async readTextFile(params: { path: string }) {
        const fs = await import("fs");
        return { content: fs.readFileSync(params.path, "utf-8") };
      },
    };

    const connection = new acp.ClientSideConnection(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_agent) => client as any,
      stream,
    );

    await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        terminal: true,
        fs: { readTextFile: true, writeTextFile: true },
      },
    });

    const { sessionId } = await connection.newSession({
      cwd: opts.cwd ?? process.cwd(),
      mcpServers: [],
    });

    const fullPrompt = opts.systemPrompt
      ? `<system-context>\n${opts.systemPrompt}\n</system-context>\n\n${opts.prompt}`
      : opts.prompt;

    const promptDone = connection
      .prompt({
        sessionId,
        prompt: [{ type: "text", text: fullPrompt }],
      })
      .then(() => {
        push({ type: "done" });
        done = true;
      })
      .catch((err) => {
        push({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        done = true;
      });

    while (!done) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }
    }
    while (queue.length > 0) {
      yield queue.shift()!;
    }

    await promptDone;
    agentProcess.kill();
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    agentProcess.kill();
  }
}
