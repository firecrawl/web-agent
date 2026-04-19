/**
 * Live end-to-end schema-adherence tests.
 *
 * These hit real Firecrawl + a real LLM, so they are gated on env:
 *   FIRECRAWL_API_KEY must be present, plus one model provider key.
 *
 * Run with:
 *   npx vitest run schema-adherence.live
 *
 * The suite exercises the full plan → run pipeline against three shapes
 * and checks both the contract (RunResult.schemaMismatch matches manual
 * validation) and that `plan()` with a schema mentions the field paths.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createAgentFromEnv } from "./agent";
import { validateAgainstSchema, coerceToJson } from "./schema-validate";

function loadEnv(p: string) {
  try {
    const body = readFileSync(p, "utf-8");
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv(path.resolve(process.cwd(), ".env.local"));
loadEnv(path.resolve(process.cwd(), "../.env.local"));

const hasKeys =
  !!process.env.FIRECRAWL_API_KEY &&
  (!!process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY);

const d = hasKeys ? describe : describe.skip;

d("schema adherence — live", () => {
  // Prefer Anthropic — Google's generateContent API rejects `const` fields
  // that the Firecrawl toolkit's zod schemas emit, so Gemini can't bind the
  // tool set here. Keep Google only for the planner-only test.
  const provider = process.env.ANTHROPIC_API_KEY
    ? { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" }
    : process.env.OPENAI_API_KEY
      ? { provider: "openai" as const, model: "gpt-5.4" }
      : { provider: "google" as const, model: "gemini-3-flash-preview" };

  it(
    "plan() includes required field paths when given a schema",
    async () => {
      const agent = createAgentFromEnv({ model: provider });
      const schema = { name: "", price_usd: 0, url: "" };
      const plan = await agent.plan(
        "Get the Firecrawl Hobby plan pricing details from firecrawl.dev/pricing",
        schema,
      );
      expect(plan.toLowerCase()).toContain("name");
      expect(plan.toLowerCase()).toContain("price_usd");
      expect(plan.toLowerCase()).toContain("url");
    },
    60_000,
  );

  it(
    "flat schema: every field present in final output",
    async () => {
      const agent = createAgentFromEnv({ model: provider, maxSteps: 25 });
      const schema = { product_name: "", tagline: "", homepage_url: "" };
      const result = await agent.run({
        prompt: "Visit https://firecrawl.dev and extract product_name, tagline, and homepage_url from the hero section.",
        schema,
        format: "json",
      });
      const parsed = coerceToJson(result.data);
      const v = validateAgainstSchema(schema, parsed);
      expect(
        { ok: v.ok, missing: v.missing, extra: v.extra, reported: result.schemaMismatch ?? null },
      ).toEqual({ ok: true, missing: [], extra: [], reported: null });
    },
    300_000,
  );

  it(
    "nested schema: populates company.{name,url} and cheapest_paid_plan.*",
    async () => {
      const agent = createAgentFromEnv({ model: provider, maxSteps: 30 });
      const schema = {
        company: { name: "", url: "" },
        cheapest_paid_plan: { name: "", price_usd_per_month: 0 },
      };
      const result = await agent.run({
        prompt: "Visit https://firecrawl.dev/pricing and extract the company identity plus the cheapest paid tier (name and price in USD per month).",
        schema,
        format: "json",
      });
      const parsed = coerceToJson(result.data);
      const v = validateAgainstSchema(schema, parsed);
      // We accept either a clean pass OR a reported mismatch that matches
      // what our validator says — the contract is that they agree.
      if (!v.ok) {
        expect(result.schemaMismatch).toEqual({
          missing: v.missing,
          extra: v.extra,
        });
      } else {
        expect(result.schemaMismatch).toBeUndefined();
      }
      expect(v.ok).toBe(true);
    },
    300_000,
  );

  it(
    "array-of-objects schema: each item has every field",
    async () => {
      const agent = createAgentFromEnv({ model: provider, maxSteps: 30 });
      const schema = {
        tiers: [{ name: "", price_usd_per_month: 0 }],
      };
      const result = await agent.run({
        prompt: "Visit https://firecrawl.dev/pricing and return the first two paid tiers. Each tier must have name and price_usd_per_month.",
        schema,
        format: "json",
      });
      const parsed = coerceToJson(result.data) as {
        tiers?: Array<Record<string, unknown>>;
      } | null;
      const v = validateAgainstSchema(schema, parsed);
      if (!v.ok) {
        expect(result.schemaMismatch).toEqual({
          missing: v.missing,
          extra: v.extra,
        });
      }
      expect(parsed?.tiers?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(v.ok).toBe(true);
    },
    300_000,
  );
});
