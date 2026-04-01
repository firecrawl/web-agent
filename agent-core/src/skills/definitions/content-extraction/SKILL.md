---
name: content-extraction
description: Extract full content from articles, docs, recipes, legal texts. Preserves structure and never truncates.
category: Research
---

# Content Extraction

## Strategy
1. Scrape with formats: ["markdown"] to get full content
2. If the page has subpages or pagination, scrape ALL of them
3. For documentation sites, scrape all pages linked from the sidebar/nav
4. For GitHub, use raw.githubusercontent.com URLs for source files
5. NEVER summarize or truncate -- preserve the complete content

## Content Types

**Recipes**: ingredients with amount/unit separated, ordered steps (complete, not summarized), prep/cook time, servings

**Articles/Docs**: preserve hierarchical section structure, include all subsections, extract author/date/source

**Legal documents**: preserve numbering and cross-references exactly, do NOT translate, keep original language

**Source code/raw content**: output verbatim, no formatting changes

## Multi-language
- Extract in the SOURCE language -- do not translate unless asked
- Preserve original character sets

## Output
- Call formatOutput with the structured data
- Match schema exactly if provided
- Include source URLs
