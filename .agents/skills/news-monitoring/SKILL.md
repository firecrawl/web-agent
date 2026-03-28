---
name: news-monitoring
description: Monitor and summarize recent news, trends, and discussions about a topic, company, or industry from multiple sources.
category: Research
---

# News Monitoring

When monitoring news and trends:

## 1. Source Strategy
- Search for the topic with time-focused queries (e.g., "[topic] 2025", "[topic] latest")
- Check major aggregators: Hacker News, Reddit, Product Hunt, TechCrunch
- Use site-specific searches for key publications in the relevant industry

## 2. Collection
- Search from multiple angles: news, announcements, opinions, analysis
- Scrape the top 5-10 most relevant articles per query
- Extract: title, date, source, author, key points, URL
- Note the publication date to sort by recency

## 3. Signal Detection
- Identify recurring themes across multiple sources
- Flag breaking news or significant announcements
- Note sentiment: positive, negative, neutral coverage
- Track which companies or people are mentioned most

## 4. Trend Analysis
- Group articles by theme or subtopic
- Identify emerging patterns vs established narratives
- Note any contradictions or debates in the coverage
- Compare coverage volume over time if possible

## 5. Output
- Use `formatOutput` with markdown for a readable briefing
- Structure as: executive summary, key stories, trends, sources
- Include links to all original sources
- For JSON: group by theme with article arrays per theme
