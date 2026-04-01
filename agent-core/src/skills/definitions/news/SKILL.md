---
name: news
description: Extract news articles, discussions, and trending content from news aggregators and forums.
category: News
---

# News Extraction

## Strategy
- For trending/front page: scrape the main page, extract all story links with titles and metadata
- For specific topics: use search to find relevant articles across multiple sites
- Always capture: title, URL, author, date, score/upvotes if available

## Common Patterns
- News sites often have RSS feeds at /rss, /feed, or /atom.xml -- check these first
- Pagination: older stories via ?page=N or date-based navigation
- Comment sections often load separately via JavaScript

## Output
- Sort by date (newest first) unless otherwise specified
- Include source domain for each article
- Call formatOutput with structured data
