---
name: pricing-tracker
description: |
  Extract and normalize pricing tiers from any SaaS, API, cloud, or LLM vendor's pricing page. Use this skill whenever the user says "pricing for X", "how much does X cost", "pricing tiers", "cost comparison", provides a URL ending in `/pricing` or `/plans`, or asks to monitor pricing over time. Pairs well with `exportSkill` to turn a run into a cron-friendly workflow. Scrape-driven; no interact needed for typical pricing pages.
category: Research
---

# Pricing Tracker

Extract pricing tiers from a vendor's pricing page and normalize them into a consistent shape. Optimized for SaaS, API, cloud, LLM, and CDN pricing pages — all of which share similar structure but inconsistent naming.

## When to use

- User provides a pricing URL: "get pricing from https://openai.com/api/pricing"
- User names a vendor: "what does Vercel cost?", "get Anthropic API pricing"
- User wants to compare prices across vendors (delegate per-vendor extraction to this skill, then aggregate)
- User wants to monitor pricing on a schedule (combine with `exportSkill: true` to generate a standalone workflow)

Do NOT use for e-commerce SKU pricing — use `e-commerce` instead.

## Strategy

1. **Find the pricing URL.**
   - If the user provided one, use it.
   - Otherwise search `"<vendor> pricing"` and take the top result from the vendor's own domain.

2. **Scrape with `only-main-content`.** Pricing pages are heavy on nav and testimonials that waste context.

3. **Identify the unit.** Every pricing page has one of these shapes — pick the right one:
   - **Per seat** — SaaS (Notion, Linear, Vercel)
   - **Per request / token / call** — API and LLM (OpenAI, Anthropic)
   - **Per GB / TB** — storage, bandwidth, CDN
   - **Per minute / hour** — compute (Modal, Replicate)
   - **Flat monthly** — simple SaaS tiers
   - **Usage-based with tiers** — cloud (AWS, GCP)

4. **Extract every tier.** Include Free and Enterprise even when their price is `$0` or `"Contact sales"` — users care about those as much as the paid tiers.

5. **Flag the gotchas.**
   - Annual vs monthly pricing (often a 20% discount buried on annual)
   - Overage rates past the included quota
   - Seat minimums ("Team plan starts at 5 seats")
   - Features gated to higher tiers
   - "Free tier" that requires a credit card

6. **Call `formatOutput` once** with the full pricing object.

## Quick start

```typescript
// Single vendor
await agent.run({
  prompt: 'Get OpenAI API pricing for every model',
  urls: ['https://openai.com/api/pricing'],
  skills: ['pricing-tracker'],
  format: 'json',
})
```

```typescript
// Export as cron-friendly workflow for price monitoring
await agent.run({
  prompt: 'Track Vercel Pro pricing',
  urls: ['https://vercel.com/pricing'],
  skills: ['pricing-tracker'],
  exportSkill: true,
})
// exportedSkill.workflow → standalone script you can run on a schedule
```

## Output schema

```json
{
  "vendor": "OpenAI",
  "url": "https://openai.com/api/pricing",
  "currency": "USD",
  "billingPeriod": "monthly",
  "unit": "per 1M tokens",
  "tiers": [
    {
      "name": "gpt-4o",
      "price": 2.5,
      "unit": "per 1M input tokens",
      "includedQuota": null,
      "features": [],
      "limits": {},
      "enterpriseOnly": false
    }
  ],
  "freeTierAvailable": false,
  "enterpriseContactOnly": false,
  "notes": "Output tokens priced separately at $10 / 1M. Batch API is 50% off.",
  "capturedAt": "2026-04-15",
  "sources": ["https://openai.com/api/pricing"]
}
```

## Tips

- **Numbers are numbers, not strings.** Price `2.5`, never `"$2.50"`. Strip currency symbols and commas. Put the currency in `currency` and the unit in `unit`.
- **Do not guess.** If a tier shows "Contact sales", put `null` in `price` and set `enterpriseContactOnly: true`. Never make up a number.
- **Model-tier grids count as tiers.** For LLM pricing pages with many models, emit one `tier` entry per model.
- **Capture `capturedAt: <date>` in every output.** Makes downstream diffing against a previous run trivial.
- **Annual vs monthly:** if both are shown, capture the monthly rate as the primary price and note the annual discount in `notes`.
- **Always include `sources: [...]`** — at minimum the scraped pricing URL.

## See also

- [competitor-analysis](../competitor-analysis/SKILL.md) — when pricing is one axis of a broader comparison
- [structured-extraction](../structured-extraction/SKILL.md) — lower-level helper if your schema diverges from the default
- [deep-research](../deep-research/SKILL.md) — for pricing that requires cross-referencing third-party sources
