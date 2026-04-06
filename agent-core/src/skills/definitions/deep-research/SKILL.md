---
name: deep-research
description: Multi-source research with source triangulation and fact-checking. Use for any research task requiring 3+ sources.
category: Research
---

# Deep Research

## Search Strategy
- Break the topic into 3-5 distinct angles
- 2-3 queries per angle using different terminology
- Use `site:` operator for targeted searches (e.g. `site:arxiv.org`, `site:github.com`)
- Include official, comparison, and review-oriented queries
- Aim for 5-10 unique, high-quality sources

## Extraction
- Scrape each source with a targeted query parameter -- don't dump full pages into context
- Extract: key claims, data points, dates, attributed quotes
- Record author, publication, date, and URL for every source

## Fact-Checking
- Cross-reference claims across 2+ sources
- Flag single-source claims explicitly
- Assign confidence: high (3+ sources agree), medium (2), low (1 or conflicting)
- Include contrarian viewpoints -- don't confirmation-bias the results

## Output
- Structure by subtopic, not by source
- Inline citations for every claim
- Call formatOutput with the structured data
