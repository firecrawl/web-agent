import { describe, it, expect } from "vitest";
import { coerceStringifiedJson } from "./adapter";

describe("coerceStringifiedJson", () => {
  it("parses a stringified JSON array back into a real array", () => {
    const input = {
      url: "https://example.com",
      formats: '[{"type": "json", "prompt": "extract data"}]',
    };
    const result = coerceStringifiedJson(input) as Record<string, unknown>;
    expect(result.url).toBe("https://example.com");
    expect(result.formats).toEqual([{ type: "json", prompt: "extract data" }]);
  });

  it("parses a stringified JSON object back into a real object", () => {
    const input = { schema: '{"type": "object", "properties": {}}' };
    const result = coerceStringifiedJson(input) as Record<string, unknown>;
    expect(result.schema).toEqual({ type: "object", properties: {} });
  });

  it("leaves non-JSON strings untouched", () => {
    const input = { url: "https://example.com", query: "hello world" };
    expect(coerceStringifiedJson(input)).toBe(input); // same reference
  });

  it("leaves actual arrays/objects untouched", () => {
    const formats = [{ type: "json" }];
    const input = { url: "https://example.com", formats };
    expect(coerceStringifiedJson(input)).toBe(input);
  });

  it("handles invalid JSON strings gracefully", () => {
    const input = { data: "[not valid json" };
    expect(coerceStringifiedJson(input)).toBe(input);
  });

  it("passes through non-object inputs unchanged", () => {
    expect(coerceStringifiedJson("hello")).toBe("hello");
    expect(coerceStringifiedJson(42)).toBe(42);
    expect(coerceStringifiedJson(null)).toBe(null);
    expect(coerceStringifiedJson(undefined)).toBe(undefined);
    const arr = [1, 2, 3];
    expect(coerceStringifiedJson(arr)).toBe(arr);
  });

  it("handles mixed fields — only coerces stringified JSON ones", () => {
    const input = {
      url: "https://example.com",
      formats: '[{"type":"markdown"}]',
      proxy: "stealth",
    };
    const result = coerceStringifiedJson(input) as Record<string, unknown>;
    expect(result.url).toBe("https://example.com");
    expect(result.formats).toEqual([{ type: "markdown" }]);
    expect(result.proxy).toBe("stealth");
  });
});
