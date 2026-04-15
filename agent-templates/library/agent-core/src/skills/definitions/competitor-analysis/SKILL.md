---
name: competitor-analysis
description: |
  Compare two or more companies, products, or platforms across pricing, features, positioning, and docs. Use this skill whenever the user says "compare X vs Y", "how does X stack up against Y", "alternatives to X", "competitive landscape of …", "X vs Y vs Z", or asks for a competitor matrix. Uses search to discover competitors when the user only names a category, then scrape for each competitor's homepage, pricing page, and features/docs. Returns a normalized comparison matrix as JSON.
category: Research
---

# Competitor Analysis

Structured side-by-side comparison of competing products. Designed for search + scrape; no interact needed for typical marketing/pricing pages.

## When to use

- User names 2+ companies or products: "compare Vercel, Netlify, Cloudflare Pages"
- User names a category only: "best CDNs for edge functions" — search to discover the top 3–5 players, then analyze
- User asks for alternatives: "what are the alternatives to X?"
- User wants a feature matrix or positioning summary

Do NOT use for single-vendor deep-dives — use `deep-research` or `structured-extraction` instead.

## Strategy

1. **Identify competitors.**
   - If the user listed them, use that list.
   - Otherwise search once: `"top <category> providers 2026"` or `"<product> alternatives"`. Pick the 3–5 most-cited.

2. **For each competitor, gather three pages:**
   - **Homepage** — one-line positioning, target audience
   - **Pricing page** (usually `/pricing` or `/plans`) — tiers, units, free tier, enterprise gate
   - **Features or product page** — top 5–10 capabilities, any standout differentiators

3. **Fan out when scale warrants.**
   - 2–3 competitors: stay in the orchestrator, scrape serially or with parallel tool calls.
   - 4+ competitors: use `spawnAgents`, one worker per competitor. Each worker gets the 3 URLs above and returns a normalized sub-object.

4. **Normalize before formatting.**
   - Align pricing tiers by role (Free / Pro / Team / Enterprise) even when vendors name them differently.
   - Call out where a competitor has a capability the others don't.
   - Flag anything missing (e.g. "Enterprise pricing is contact-sales only").

5. **Call `formatOutput` once at the end** with the full matrix.

## Quick start

```typescript
await agent.run({
  prompt: 'Compare Vercel, Netlify, and Cloudflare Pages on pricing, edge functions, and free tier generosity',
  skills: ['competitor-analysis'],
  format: 'json',
})
```

```typescript
// User gave only a category — discover competitors first
await agent.run({
  prompt: 'Compare the top 4 vector databases for production RAG workloads',
  skills: ['competitor-analysis'],
  format: 'json',
})
```

## Output schema

Every run should produce an object with this shape (add fields as the user's prompt demands):

```json
{
  "category": "Edge hosting platforms",
  "competitors": [
    {
      "name": "Vercel",
      "url": "https://vercel.com",
      "positioning": "Frontend cloud for Next.js and React",
      "pricing": [
        { "tier": "Hobby", "price": 0, "unit": "month", "limits": {} },
        { "tier": "Pro", "price": 20, "unit": "seat/month", "limits": {} }
      ],
      "strengths": [],
      "weaknesses": [],
      "freeTier": true,
      "enterpriseContactOnly": false,
      "sources": []
    }
  ],
  "summary": "One-paragraph takeaway comparing the field.",
  "bestFit": {
    "budgetConscious": "",
    "enterprise": "",
    "developer": ""
  }
}
```

## Tips

- **Pricing pages lie by omission.** Always look for overages, egress costs, and seat minimums that show up only in a footnote.
- **Marketing copy is noise.** Prefer the pricing page and docs over the homepage for factual claims.
- **If a scrape returns 404 on `/pricing`**, search `"<vendor> pricing"` before guessing another URL — vendors often move these pages.
- **Populate `strengths` and `weaknesses` from evidence, not opinion.** "Has a built-in KV store (competitor docs do not mention one)" is fair game; "better DX" is not.
- **Always include `sources: [...]`** on every competitor object with the URLs you actually scraped.

## See also

- [deep-research](../deep-research/SKILL.md) — multi-source validation for a single topic
- [pricing-tracker](../pricing-tracker/SKILL.md) — detail on pricing extraction when that's the only dimension
- [structured-extraction](../structured-extraction/SKILL.md) — lower-level helper for arbitrary JSON schemas
