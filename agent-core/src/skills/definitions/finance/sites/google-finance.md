---
domains: ["google.com/finance"]
platform: google-finance
---

# Google Finance Navigation

## URL Patterns
- Quote: `/finance/quote/{TICKER}` (e.g. `/finance/quote/AAPL:NASDAQ`)
- Comparison: `/finance/quote/{TICKER1}/comparison?q={TICKER2}`

## Key Data
- Price, change, after-hours price in the header
- Key stats: P/E, market cap, dividend yield, 52w range
- "About" section has company description
- News feed with related articles
- Financials tab has income statement, balance sheet, cash flow

## Gotchas
- Ticker format includes exchange: `AAPL:NASDAQ`, `MSFT:NASDAQ`
- Limited historical data compared to Yahoo Finance
- Financial statements may need interact to expand
