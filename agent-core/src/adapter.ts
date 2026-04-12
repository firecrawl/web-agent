import { tool as lcTool } from "langchain";

/**
 * Minimal AI SDK tool shape. Runtime, `tool()` from "ai" is an identity
 * helper that returns the object unchanged, so we only need these three
 * fields to convert to a LangChain tool.
 */
type AISDKTool = {
  description?: string;
  inputSchema: unknown;
  execute?: (input: any, context?: unknown) => unknown | Promise<unknown>;
};

/**
 * Wrap a single AI SDK tool so it can be used by Deep Agents / LangChain.
 *
 * LangChain tool handlers return strings; structured values get JSON-stringified
 * so the model sees consistent tool output. Downstream extractors that read
 * tool results (e.g. formatOutput content) must JSON.parse when needed.
 */
export function aiToLc(name: string, t: AISDKTool) {
  if (!t.execute) {
    throw new Error(`Tool "${name}" has no execute function`);
  }
  return lcTool(
    async (input: unknown) => {
      const result = await t.execute!(input as never);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
    {
      name,
      description: t.description ?? "",
      // LangChain accepts any Zod schema here; inputSchema is always Zod in our toolkit
      schema: t.inputSchema as never,
    },
  );
}

/**
 * Convert an AI SDK ToolSet (a record of named tools) into an array of
 * LangChain tools ready for `createDeepAgent({ tools })`.
 */
export function aiToolkitToLc(tools: Record<string, AISDKTool>) {
  return Object.entries(tools).map(([name, t]) => aiToLc(name, t));
}
