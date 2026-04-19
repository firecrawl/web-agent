import { describe, it, expect } from "vitest";
import {
  coerceToJson,
  extractFieldPaths,
  validateAgainstSchema,
} from "./schema-validate";

describe("extractFieldPaths", () => {
  it("extracts flat keys", () => {
    expect(extractFieldPaths({ name: "", price: 0 })).toEqual(["name", "price"]);
  });

  it("extracts nested keys with dotted paths", () => {
    expect(
      extractFieldPaths({
        product: { name: "", price: { currency: "", amount: 0 } },
      }),
    ).toEqual(["product.name", "product.price.currency", "product.price.amount"]);
  });

  it("labels array items with []", () => {
    expect(
      extractFieldPaths({ items: [{ sku: "", qty: 0 }] }),
    ).toEqual(["items[].sku", "items[].qty"]);
  });

  it("handles arrays of primitives", () => {
    expect(extractFieldPaths({ tags: [""] })).toEqual([
      "tags[] (get ALL items)",
    ]);
  });
});

describe("validateAgainstSchema", () => {
  it("passes when all fields present", () => {
    const schema = { name: "", price: 0 };
    const data = { name: "Widget", price: 42 };
    expect(validateAgainstSchema(schema, data)).toEqual({
      ok: true,
      missing: [],
      extra: [],
    });
  });

  it("reports missing flat fields", () => {
    const schema = { name: "", price: 0, sku: "" };
    const data = { name: "Widget", price: 42 };
    const result = validateAgainstSchema(schema, data);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["sku"]);
    expect(result.extra).toEqual([]);
  });

  it("reports extra fields", () => {
    const schema = { name: "" };
    const data = { name: "Widget", color: "red" };
    const result = validateAgainstSchema(schema, data);
    expect(result.ok).toBe(false);
    expect(result.extra).toEqual(["color"]);
  });

  it("walks nested schemas", () => {
    const schema = { product: { name: "", price: 0 } };
    const data = { product: { name: "Widget" } };
    const result = validateAgainstSchema(schema, data);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["product.price"]);
  });

  it("validates every item in an array of objects", () => {
    const schema = { items: [{ sku: "", qty: 0 }] };
    const data = {
      items: [
        { sku: "A", qty: 1 },
        { sku: "B" }, // missing qty
      ],
    };
    const result = validateAgainstSchema(schema, data);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["items[1].qty"]);
  });

  it("treats empty strings as missing", () => {
    const schema = { name: "" };
    const data = { name: "   " };
    expect(validateAgainstSchema(schema, data).ok).toBe(false);
  });

  it("treats empty arrays as missing", () => {
    const schema = { items: [{ sku: "" }] };
    const data = { items: [] };
    const result = validateAgainstSchema(schema, data);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["items[]"]);
  });
});

describe("coerceToJson", () => {
  it("parses JSON strings", () => {
    expect(coerceToJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("passes objects through", () => {
    expect(coerceToJson({ a: 1 })).toEqual({ a: 1 });
  });

  it("returns null for unparseable strings", () => {
    expect(coerceToJson("not json")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(coerceToJson("")).toBeNull();
    expect(coerceToJson(null)).toBeNull();
  });
});
