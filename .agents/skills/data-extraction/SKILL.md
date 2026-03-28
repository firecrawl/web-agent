---
name: data-extraction
description: Extract structured data from websites into clean JSON or CSV. Handles pagination, tables, and repeated elements.
category: Research
---

# Data Extraction

When extracting structured data from websites:

## 1. Schema Design
- If the user provides a JSON schema, follow it exactly
- If not, infer a schema from the first page of results
- Keep schemas flat when possible — nested objects make CSV output harder

## 2. Discovery
- Use `search` or `map` to find all relevant pages
- For paginated content, identify the pagination pattern first
- Check if a sitemap or API endpoint exists before scraping

## 3. Extraction Strategy
- Use `scrape` with `formats: ["json"]` and provide a schema for structured extraction
- For tables, use `formats: ["markdown"]` and parse the markdown table
- For repeated elements (product cards, listings), scrape the list page first

## 4. Pagination Handling
- Look for next/prev links, page numbers, or load-more buttons
- Use `interact` for infinite scroll or JavaScript pagination
- Set a reasonable limit to avoid over-scraping

## 5. Output
- Always use `formatOutput` with the user's preferred format
- For CSV: ensure consistent column ordering across all rows
- For JSON: validate against the schema before returning
- Include row count and source URLs in the output summary
