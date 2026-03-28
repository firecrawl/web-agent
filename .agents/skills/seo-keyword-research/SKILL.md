---
name: seo-keyword-research
description: Research keywords by analyzing competitor content, search results, and related queries for a given topic.
category: SEO
---

# SEO Keyword Research

When researching keywords for a topic:

## 1. Seed Query Expansion
- Take the user's topic and formulate 3-5 seed search queries
- Include variations: broad terms, long-tail phrases, question-based queries
- Add modifiers like "best", "how to", "vs", "alternative" to broaden coverage

## 2. Search Result Analysis
- Use `search` for each seed query and collect the top 10 results
- Record which domains rank for multiple queries
- Note featured snippets, "People also ask" patterns, and related searches

## 3. Content Extraction
- Scrape the top 3-5 ranking pages per seed query
- Extract all headings (H1-H3) to identify subtopics covered
- Analyze keyword density in titles, headings, and body text
- Note content length, structure, and media usage

## 4. Gap and Cluster Analysis
- Identify topics covered by competitors but missing from the user's content
- Group related keywords into thematic clusters with shared search intent
- Classify intent per cluster: informational, navigational, commercial, transactional

## 5. Output
- Produce keyword clusters with representative terms and intent labels
- Include competitor URLs that rank for each cluster
- Use `formatOutput` with the user's preferred format
