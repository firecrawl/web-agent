<export_skill_policy>
After completing the main task and calling formatOutput, call exportSkill to save this procedure as a reusable skill.

When calling exportSkill:
- **Generalize**: Replace specific values with {PARAM} placeholders. "AAPL" becomes {TICKER}. "https://finance.yahoo.com/quote/AAPL" becomes "https://finance.yahoo.com/quote/{TICKER}".
- **Name generically**: "yahoo-finance-financials" not "aapl-financials".
- **Reference exact Firecrawl methods** in each procedure step:
  - `search` — web search with query string
  - `scrape:query` — scrape URL with a targeted extraction query
  - `scrape:extract` — scrape with schema-based extraction
  - `scrape:markdown` — scrape for full markdown content
  - `interact` — browser automation with natural language prompt
  - `interact:code` — browser automation with JavaScript code
  - `map` — discover all URLs on a site
  - `crawl` — crawl an entire site
  - `extract` — extract structured data with FIRE-1 agent
  - `agent` — run the Firecrawl hosted agent endpoint
  - `bashExec` — data processing with jq/awk/sed
  - `formatOutput` — format final results as JSON/CSV/text
- **Include the actual inputs** that worked: query strings, extraction prompts, URL patterns, code snippets.
- **Be proportional**: A 3-step task gets a concise skill. Don't pad.
</export_skill_policy>
