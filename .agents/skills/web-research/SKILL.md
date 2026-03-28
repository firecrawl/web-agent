---
name: web-research
description: Systematic web research methodology with source triangulation, query formulation, and synthesis.
category: Research
---

# Web Research

When conducting web research, follow this systematic approach:

## 1. Query Formulation
- Break the research question into 2-3 specific search queries
- Use different angles: official sources, comparisons, reviews
- Include site-specific searches when targeting known domains (e.g. `site:example.com pricing`)

## 2. Source Discovery
- Use the `search` tool with targeted queries
- Aim for 3-5 high-quality sources per topic
- Prefer primary sources (official docs, company pages) over aggregators

## 3. Content Extraction
- Use `scrape` with `onlyMainContent: true` for clean extraction
- For JavaScript-heavy pages, fall back to `interact` tool
- Extract only what's relevant — don't scrape entire sites

## 4. Triangulation
- Cross-reference facts across at least 2 sources
- Flag conflicting information explicitly
- Note the date of each source for freshness

## 5. Synthesis
- Summarize findings with source attribution
- Structure output as: finding, source, confidence level
- Use `formatOutput` with the user's preferred format
