---
name: financial-research
description: |
  Pull company financials, SEC filings, and analyst consensus for a public company. Use this skill whenever the user says "10-K", "10-Q", "earnings", "revenue of", "financials for", "analyst rating for", "price target for", or provides a stock ticker. Combines SEC EDGAR for official filings with Yahoo Finance / TipRanks for analyst data. Search + scrape only; no interact needed.
category: Research
---

# Financial Research

Extract official financials from SEC filings and cross-reference with analyst consensus. Public companies only.

## When to use

- User asks for a company's financials: "revenue of NVIDIA", "Apple's latest 10-K"
- User asks for analyst sentiment: "what are analysts saying about TSLA?"
- User provides a ticker with no clear verb: "MSFT" → assume they want a financial overview
- User wants an earnings summary before or after a release

Do NOT use for private company research, crypto, or macro/market commentary — `deep-research` handles those better.

## Strategy

1. **Resolve the ticker.**
   - User gave a ticker: use it directly.
   - User gave a company name: search `"<company> stock ticker"` and confirm from the top result.

2. **Get the latest SEC filing.**
   - Use the [sec.gov](sites/sec-gov.md) playbook to locate the most recent 10-K (annual) or 10-Q (quarterly).
   - Scrape the filing index page, then the primary filing document.
   - Extract: revenue, net income, operating income, EPS (basic and diluted), gross margin, forward guidance if given.

3. **Get analyst consensus.**
   - Use the [finance.yahoo.com](sites/yahoo-finance.md) playbook for the analyst tab.
   - Extract: consensus rating, average / low / high price target, number of analysts covering.

4. **Cross-reference.**
   - If the user asked for a specific metric, verify it against at least two sources.
   - Flag discrepancies between the filing and third-party aggregators.

5. **Call `formatOutput`** with the structured result.

## Quick start

```typescript
// Full financial overview
await agent.run({
  prompt: 'Get a complete financial overview of NVIDIA',
  skills: ['financial-research'],
  format: 'json',
})
```

```typescript
// Specific metric
await agent.run({
  prompt: 'What was AAPL revenue in the most recent quarter?',
  skills: ['financial-research'],
})
```

```typescript
// Earnings preparation for multiple tickers — delegate per-ticker
await agent.run({
  prompt: 'Get the latest reported revenue, EPS, and guidance for NVDA, AMD, and INTC',
  skills: ['financial-research'],
  format: 'json',
})
```

## Output schema

```json
{
  "ticker": "NVDA",
  "company": "NVIDIA Corporation",
  "fiscalPeriod": "FY2026 Q4 ended 2026-01-26",
  "filing": {
    "type": "10-K",
    "url": "https://www.sec.gov/...",
    "filedDate": "2026-02-21"
  },
  "financials": {
    "revenue": null,
    "netIncome": null,
    "operatingIncome": null,
    "epsBasic": null,
    "epsDiluted": null,
    "grossMargin": null,
    "unit": "USD millions"
  },
  "guidance": "",
  "analyst": {
    "rating": "Strong Buy",
    "priceTarget": { "average": null, "low": null, "high": null },
    "numAnalysts": null,
    "sourceUrl": ""
  },
  "sources": []
}
```

## Tips

- **SEC EDGAR is the source of truth for the numbers.** Yahoo and aggregators can lag or be wrong. If a number in the 10-K disagrees with Yahoo, trust EDGAR.
- **Watch the fiscal calendar.** NVIDIA, Apple, and others don't use calendar quarters — always capture the exact `fiscalPeriod` the numbers apply to.
- **Units matter.** SEC filings report in millions or thousands with a table-header note. Capture `financials.unit` so downstream consumers don't multiply by the wrong power of 10.
- **Don't fabricate analyst data.** If Yahoo's analyst page 404s or loads empty, set `analyst.rating` to null and note it in `sources`. Never guess.
- **For earnings-release watches**, include `filing.filedDate` so users can see if they're looking at yesterday's filing or last quarter's.

## See also

- [deep-research](../deep-research/SKILL.md) — for qualitative research (moats, macro, competitive dynamics)
- [structured-extraction](../structured-extraction/SKILL.md) — lower-level helper for custom financial schemas
- [competitor-analysis](../competitor-analysis/SKILL.md) — when comparing multiple public companies head-to-head
