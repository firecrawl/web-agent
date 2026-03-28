---
name: site-monitor
description: Monitor a website for content changes, new pages, broken links, and structural differences.
category: Observability
---

# Site Monitor

When monitoring a website for changes:

## 1. Site Mapping
- Use `map` to discover all current pages on the target domain
- Record the full URL list as the current snapshot
- Note the total page count and URL structure

## 2. Content Extraction
- Scrape key pages identified by the user or by priority (homepage, landing pages, pricing)
- Extract page titles, main content, and last-modified indicators
- Capture content hashes or key text sections for comparison

## 3. Baseline Comparison
- Compare the current page list against the user-provided baseline
- Identify new pages that were not in the baseline
- Identify removed pages that no longer exist
- Flag pages where content has changed significantly

## 4. Link Health Check
- Check internal links for 404s or redirect chains
- Identify external links that return errors
- Note any pages with no internal links pointing to them

## 5. Output
- Produce a change report listing new, removed, and modified pages
- Include broken link details with the source page and target URL
- Summarize overall site health with page count and error count
- Use `formatOutput` with the user's preferred format
