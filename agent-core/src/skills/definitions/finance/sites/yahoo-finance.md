---
domains: ["finance.yahoo.com"]
platform: yahoo-finance
---

# Yahoo Finance Navigation

## URL Patterns
- Quote: `/quote/{TICKER}`
- Financials: `/quote/{TICKER}/financials`
- Balance sheet: `/quote/{TICKER}/balance-sheet`
- Cash flow: `/quote/{TICKER}/cash-flow`
- Key statistics: `/quote/{TICKER}/key-statistics`
- Historical data: `/quote/{TICKER}/history`
- Analyst estimates: `/quote/{TICKER}/analysis`
- Holdings (ETFs): `/quote/{TICKER}/holdings`

## Key Data Locations
- Current price and change in the quote header
- Key stats in the summary table (right column)
- Financial statements in tabular format (may need interact to switch Annual/Quarterly)

## Gotchas
- Some data requires clicking "Expand All" for full financial statements
- Historical data paginated by date range, use `?period1=&period2=` (Unix timestamps)
- Cookie consent banner may block content in EU
