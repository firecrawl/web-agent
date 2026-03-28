---
name: financial-data
description: Extract financial data, earnings info, and market metrics from financial websites and company reports.
category: Investment & Finance
---

# Financial Data Extraction

When extracting financial data:

## 1. Source Identification
- Search for "[company] financials", "[company] earnings", "[company] annual report"
- Identify key sources: investor relations pages, SEC filings, financial data sites
- Locate the most recent quarterly and annual reports

## 2. Financial Metrics Extraction
- Scrape earnings pages and financial summaries
- Extract: revenue, net income, gross margin, operating margin, EPS
- Capture year-over-year and quarter-over-quarter growth rates
- Note fiscal year periods and reporting currency

## 3. Market Data
- Search for current market cap, stock price, and P/E ratio
- Extract analyst consensus estimates if available
- Note recent price performance and trading volume trends
- Identify sector and industry classification

## 4. Benchmarking
- Search for industry peers and comparable companies
- Compare key metrics (revenue growth, margins, multiples) against peers
- Identify where the company outperforms or underperforms its sector
- Note any significant divergences that warrant attention

## 5. Output
- Produce structured financial data with metrics, periods, and sources
- Include a peer comparison table when benchmarks are available
- Use `formatOutput` with the user's preferred format
