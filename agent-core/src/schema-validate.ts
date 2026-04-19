/**
 * Schema validator — the single source of truth for "does this output match
 * the schema the caller asked for?". Used in three places:
 *
 *   1. Orchestrator prompt: renders the field checklist the model sees.
 *   2. formatOutput gate: rejects calls that don't match before the tool
 *      completes, giving the model a chance to repair.
 *   3. Post-run extraction: populates RunResult.schemaMismatch so callers
 *      can decide what to do with partial data.
 *
 * Keeping all three paths backed by the same function is the point — the
 * plan, the enforcement, and the assessment must reference the SAME field
 * set or "strict adherence" is a lie.
 */

export interface SchemaMismatch {
  /** Dotted field paths the schema required but the data didn't provide */
  missing: string[];
  /** Top-level keys in the data that the schema didn't ask for */
  extra: string[];
}

export interface SchemaValidationResult extends SchemaMismatch {
  ok: boolean;
}

/**
 * Extract leaf field paths from an example/schema object.
 * Arrays are treated as "one representative item" — the schema shape.
 * Depth is capped at 4 to keep prompts readable.
 */
export function extractFieldPaths(
  obj: unknown,
  prefix = "",
  depth = 0,
): string[] {
  if (depth > 4) return [prefix || "(nested)"];
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [`${prefix}[]`];
    const item = obj[0];
    if (typeof item === "object" && item !== null) {
      return extractFieldPaths(item, `${prefix}[]`, depth + 1);
    }
    return [`${prefix}[] (get ALL items)`];
  }
  if (typeof obj === "object" && obj !== null) {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        paths.push(...extractFieldPaths(value, fieldPath, depth + 1));
      } else {
        paths.push(fieldPath);
      }
    }
    return paths;
  }
  return prefix ? [prefix] : [];
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Walk the schema and check every leaf field exists (and is non-empty) in
 * the data. For schema arrays, validate against every item in data[] so a
 * list of 10 products must each have every field, not just the first.
 */
function walk(
  schema: unknown,
  data: unknown,
  prefix: string,
  missing: string[],
  depth = 0,
): void {
  if (depth > 6) return;

  if (Array.isArray(schema)) {
    if (!Array.isArray(data) || data.length === 0) {
      missing.push(`${prefix}[]`);
      return;
    }
    const schemaItem = schema[0];
    if (schemaItem === undefined) return;
    const isPrimitiveSchema =
      typeof schemaItem !== "object" || schemaItem === null;
    if (isPrimitiveSchema) {
      if (data.some(isEmpty)) missing.push(`${prefix}[] (one or more items empty)`);
      return;
    }
    for (let i = 0; i < data.length; i++) {
      walk(schemaItem, data[i], `${prefix}[${i}]`, missing, depth + 1);
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      missing.push(prefix || "(root)");
      return;
    }
    const d = data as Record<string, unknown>;
    for (const [key, subSchema] of Object.entries(schema)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      if (!(key in d)) {
        missing.push(fieldPath);
        continue;
      }
      if (typeof subSchema === "object" && subSchema !== null) {
        walk(subSchema, d[key], fieldPath, missing, depth + 1);
      } else if (isEmpty(d[key])) {
        missing.push(fieldPath);
      }
    }
    return;
  }

  // Primitive schema leaf — already handled by parent walk
  if (isEmpty(data)) missing.push(prefix || "(root)");
}

export function validateAgainstSchema(
  schema: unknown,
  data: unknown,
): SchemaValidationResult {
  const missing: string[] = [];
  const extra: string[] = [];

  walk(schema, data, "", missing);

  if (
    schema &&
    typeof schema === "object" &&
    !Array.isArray(schema) &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const schemaKeys = new Set(Object.keys(schema as Record<string, unknown>));
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (!schemaKeys.has(key)) extra.push(key);
    }
  }

  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/**
 * Coerce whatever the model passed to formatOutput (string JSON, object,
 * array) into a JS value for validation. Returns null if not parseable —
 * caller treats that as "no data, validation fails".
 */
export function coerceToJson(input: unknown): unknown {
  if (input == null) return null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return input;
}
