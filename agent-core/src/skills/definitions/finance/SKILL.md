---
name: finance
description: Extract financial data from market sites, SEC filings, and earnings reports. Knows common financial metrics and data sources.
category: Finance
---

# Finance Data Extraction

## Common Metrics
- Price, change ($ and %), volume, market cap
- P/E ratio (trailing and forward), EPS, dividend yield
- Revenue, net income, gross/operating/net margins
- 52-week high/low, average volume
- Analyst ratings and price targets

## Data Sources (in order of preference)
1. Direct company investor relations pages (/investors, /ir)
2. Financial data aggregators (Yahoo Finance, Google Finance)
3. SEC EDGAR for official filings
4. News sites for recent earnings

## Earnings Data
- Look for quarterly (10-Q) and annual (10-K) filings
- Key: revenue, net income, EPS (actual vs estimate), guidance
- Year-over-year and quarter-over-quarter comparisons

## Output
- Prices must be numbers, not strings
- Include currency (USD, EUR, etc.)
- Include data timestamp/date
- Call formatOutput with structured data
