import { tool as lcTool } from "langchain";
import { z } from "zod";

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
 * Auto-parse stringified JSON values in tool input.
 *
 * LLMs sometimes serialize complex arguments (arrays, objects) as JSON
 * strings instead of passing them as structured values. For example,
 * `{ formats: "[{...}]" }` instead of `{ formats: [{...}] }`.
 * This causes Zod validation to reject the input before the handler runs.
 *
 * This function walks top-level fields and parses any string that looks
 * like a JSON array or object back into the real value.
 */
export function coerceStringifiedJson(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string" && v.length > 1) {
      const trimmed = v.trim();
      if ((trimmed[0] === "[" && trimmed[trimmed.length - 1] === "]") ||
          (trimmed[0] === "{" && trimmed[trimmed.length - 1] === "}")) {
        try {
          out[k] = JSON.parse(trimmed);
          changed = true;
          continue;
        } catch {
          // Not valid JSON — keep as string
        }
      }
    }
    out[k] = v;
  }
  return changed ? out : input;
}

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
  // Wrap the schema with z.preprocess so stringified JSON is coerced
  // BEFORE Zod validates the input — not after.
  const schema = z.preprocess(coerceStringifiedJson, t.inputSchema as z.ZodTypeAny);

  return lcTool(
    async (input: unknown) => {
      const result = await t.execute!(input as never);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
    {
      name,
      description: t.description ?? "",
      schema: schema as never,
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
