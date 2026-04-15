---
platform: SEC EDGAR
domains:
  - sec.gov
  - www.sec.gov
---

# SEC EDGAR (sec.gov)

The authoritative source for US-listed company filings. Always prefer EDGAR over third-party aggregators when the number has to be right.

## Entry points

- **Company search**: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<TICKER>&type=10-K`
  - Replace `10-K` with `10-Q` for quarterly, `8-K` for material events.
- **Full-text filing search**: `https://efts.sec.gov/LATEST/search-index?q=<query>&forms=10-K`

## Workflow

1. **Find the company.** Search `site:sec.gov <company> 10-K` or use the URL above with the ticker.
2. **Pick the filing.** The listing page shows all filings of a type, newest first. Scrape the listing, take the top row's "Documents" link.
3. **Find the primary document.** The filing index lists multiple exhibits. The primary 10-K is the one ending in `.htm` with the largest file size (usually a few MB). Ignore `R*.htm` (these are taxonomy views).
4. **Extract financials.** Key sections: "Consolidated Statements of Operations" (income statement), "Consolidated Balance Sheets", "Management's Discussion and Analysis" (MD&A) for commentary and guidance.

## Field map

| User asks for | Look in |
|---|---|
| Revenue | Income statement → "Net revenue" or "Revenue, net" |
| Net income | Income statement → "Net income" (bottom line) |
| EPS | Income statement → "Earnings per share — basic / diluted" |
| Gross margin | Income statement → (Revenue − Cost of revenue) ÷ Revenue |
| Guidance | MD&A → look for "Outlook" or "Forward-looking" sections |
| Segment breakdown | Notes to financial statements → "Segment information" |

## Tips

- 10-K filings are long (100k+ tokens). **Always scrape with a targeted query** rather than dumping the full document.
- **Capture the units header.** Every financial table has a header like "(in millions, except per share data)" — the skill's output must include `financials.unit`.
- **Fiscal year != calendar year** for many tech companies. The 10-K cover page states the period covered.
- **8-K filings** (current reports) are where earnings releases and press releases live — useful for freshest numbers before the full 10-Q is filed.
