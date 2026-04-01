---
name: structured-extraction
description: Extract structured data matching a JSON schema from websites. Handles complex nested schemas, arrays, pagination, and validation. Always outputs via formatOutput.
category: Research
---

# Structured Extraction

Use this skill when extracting data that must match a specific JSON schema.

## Strategy by task type

### Simple query (single fact or small object)
1. Search for relevant results.
2. Scrape promising results with a targeted query.
3. Build the result object and call formatOutput immediately.

### Single target research (one entity, multiple fields)
1. Search for relevant URLs.
2. Scrape to extract data — use spawnAgents if researching multiple independent sources.
3. Compile findings and call formatOutput.

### List of items (array in schema)
1. Search/scrape to get the list of items.
2. Are all requested details included in the list?
   - Yes: Build the result and call formatOutput.
   - No: Use spawnAgents to research each item in parallel. Each agent gets the item name and specific fields to find.
3. Aggregate all results and call formatOutput.

### All items from a website
1. Check sitemaps (sitemap.xml, robots.txt) for an easy route to all pages.
2. Scrape the entry page. Determine: pagination? Categories? Subcategories?
3. For pagination, use interact to click through every page.
4. For categories, scrape each category — use spawnAgents for parallel processing.
5. Aggregate and call formatOutput.

## Scraping for structured data
- PREFER scrape with a targeted query over raw page dumps. It keeps context lean.
- When scraping lists, ALWAYS ask about pagination in your query: "How many total results? Is there a next page?"
- For 2+ URLs, use spawnAgents — each agent gets specific URLs and fields to extract.
- If a scrape returns a 404 or bot-check, do NOT retry. Move on to alternative sources.

## Building the output
- Match the schema EXACTLY. Every required field must be present.
- Use null for missing fields — never omit keys.
- Arrays must be arrays even for single items.
- Numbers must be actual numbers, not strings (10.99 not "$10.99").
- Use bashExec with jq to merge data from multiple sources:
  ```
  jq -s '.[0] * .[1]' /data/part1.json /data/part2.json > /data/merged.json
  ```

## Validation before output
Before calling formatOutput, verify:
1. All required fields from the schema are present.
2. Types match (numbers are numbers, arrays are arrays).
3. No duplicate entries in arrays.
4. Source URLs are included where the schema has citation fields.

## CRITICAL: Always call formatOutput
When you have gathered ALL data, call formatOutput with format "json" and the structured data.
Do NOT stream data inline as markdown tables or JSON code blocks.
Do NOT skip formatOutput — downstream systems depend on the structured output.
