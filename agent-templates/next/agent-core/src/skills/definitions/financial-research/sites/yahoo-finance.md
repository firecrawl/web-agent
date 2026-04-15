---
platform: Yahoo Finance
domains:
  - finance.yahoo.com
---

# Yahoo Finance (finance.yahoo.com)

Go-to source for analyst consensus, price targets, and historical price data. Free, no login needed.

## Entry points

- **Summary page**: `https://finance.yahoo.com/quote/<TICKER>`
- **Analysts tab**: `https://finance.yahoo.com/quote/<TICKER>/analysts`
- **Financials tab**: `https://finance.yahoo.com/quote/<TICKER>/financials` (Yahoo's reformatted version of the income statement)
- **Key statistics**: `https://finance.yahoo.com/quote/<TICKER>/key-statistics`

## Workflow

1. **Resolve ticker** if you only have a company name — search `"<company> stock ticker"` first.
2. **Scrape the analysts page** for consensus data.
3. **If EDGAR hasn't been consulted yet**, Yahoo's financials tab is a reasonable fallback, but prefer the 10-K / 10-Q when precision matters.

## Field map

| User asks for | Scrape | Look for |
|---|---|---|
| Analyst rating | `/analysts` | "Recommendation Rating" or "Recommendation Trends" |
| Price target | `/analysts` | "Price Target" with Avg / Low / High |
| Number of analysts | `/analysts` | Count near the price target card |
| Current price | `/quote/<TICKER>` | Top of page |
| Market cap | `/key-statistics` | "Market Cap (intraday)" |
| P/E ratio | `/key-statistics` | "Trailing P/E" |
| Revenue (TTM) | `/key-statistics` or `/financials` | "Revenue (ttm)" |

## Tips

- **Yahoo aggregates and can be stale.** Analyst data is usually fresh; reported financials can lag EDGAR by days.
- **The analyst page is JS-rendered.** A plain scrape works in most cases, but if the price target section is empty, add `--wait-for 3000` equivalent or fall back to a search for "<TICKER> analyst price target".
- **Consensus rating scale**: Yahoo uses 1 (Strong Buy) to 5 (Sell). Preserve the text label in output (`"Strong Buy"`, not `1`).
- **Missing analyst data is common for small caps and recent IPOs** — populate with `null` and move on, don't retry.
