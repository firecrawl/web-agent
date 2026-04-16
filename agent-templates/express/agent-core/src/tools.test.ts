import { describe, it, expect } from "vitest";
import { formatOutput } from "./tools";

// formatOutput.execute always returns a plain object in practice,
// but the AI SDK types it as possibly undefined or AsyncIterable.
const exec = formatOutput.execute! as unknown as (
  input: { format: string; data: unknown; columns?: string[] },
  ctx: { toolCallId: string; messages: never[]; abortSignal: AbortSignal },
) => Promise<{ format: string; content: string }>;

describe("formatOutput", () => {
  describe("json format", () => {
    it("formats an object as JSON", async () => {
      const result = await exec(
        { format: "json", data: { name: "test", price: 10 } },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.format).toBe("json");
      const parsed = JSON.parse(result.content);
      expect(parsed).toEqual({ name: "test", price: 10 });
    });

    it("formats an array as JSON", async () => {
      const result = await exec(
        { format: "json", data: [1, 2, 3] },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.format).toBe("json");
      expect(JSON.parse(result.content)).toEqual([1, 2, 3]);
    });

    it("passes through valid JSON strings", async () => {
      const jsonStr = '{"already":"json"}';
      const result = await exec(
        { format: "json", data: jsonStr },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.content).toBe(jsonStr);
    });

    it("wraps non-JSON strings", async () => {
      const result = await exec(
        { format: "json", data: "plain text" },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.format).toBe("json");
      expect(JSON.parse(result.content)).toBe("plain text");
    });
  });

  describe("text format", () => {
    it("passes through strings", async () => {
      const result = await exec(
        { format: "text", data: "Hello world" },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.format).toBe("text");
      expect(result.content).toBe("Hello world");
    });

    it("JSON-stringifies non-string data", async () => {
      const result = await exec(
        { format: "text", data: { key: "value" } },
        { toolCallId: "test", messages: [], abortSignal: AbortSignal.timeout(5000) },
      );
      expect(result.content).toContain('"key"');
      expect(result.content).toContain('"value"');
    });
  });
});
