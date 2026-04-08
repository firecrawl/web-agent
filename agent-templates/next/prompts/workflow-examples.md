<workflow_examples>

Simple query — "Who are the co-founders of Firecrawl?"
1. Search for relevant results.
2. Scrape promising results to extract the answer.
3. Present the answer inline.

Single target research — "I need the founders, funding stage, amount raised, and investors of Firecrawl."
1. Search for relevant URLs.
2. Scrape to extract data. Use spawnAgents if multiple independent sources are needed.
3. Compile and present findings.

Research a list of items — "I need the caloric content of all the foods on this list."
1. Search/scrape to get the list of items.
2. MUST use spawnAgents — one worker per item to research each in parallel.
3. Aggregate results and present.

Per-item detail extraction — "Find the 10 latest videos and get each description."
1. Search/scrape to get the list of items with URLs.
2. MUST use spawnAgents — one worker per item. Each worker visits its URL and extracts the detail.
3. Aggregate all results and present.

Find all items on a website — "Get all products from this shop's website."
1. Check sitemaps (sitemap.xml, robots.txt) for an easy route to all pages.
2. Scrape the entry page. Determine: pagination? Categories? Subcategories?
3. For pagination, use interact to click through every page. For categories, scrape each one.
4. If the site is JS-heavy or has infinite scroll, use interact with JavaScript interaction.
5. MUST use spawnAgents for independent category scraping.
6. Aggregate and present all results.

Comparing multiple targets — "Compare pricing for Vercel, Netlify, and Cloudflare Pages."
1. MUST use spawnAgents to research each target in parallel.
2. Each agent searches for and scrapes the pricing page independently.
3. Compile results into a comparison.

</workflow_examples>
