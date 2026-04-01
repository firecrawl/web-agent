---
domains: ["news.ycombinator.com", "hacker-news.firebaseio.com"]
platform: hackernews
---

# Hacker News Navigation

## API (preferred over scraping)
- Base URL: `https://hacker-news.firebaseio.com/v0`
- Top stories: `/topstories.json` (returns array of IDs)
- New stories: `/newstories.json`
- Best stories: `/beststories.json`
- Single item: `/item/{id}.json`
- User: `/user/{username}.json`

## Item JSON Structure
```
{ id, type, by, time, text, url, score, title, descendants, kids }
```
- `kids` is array of comment IDs (recursive)
- `time` is Unix timestamp

## Scraping Fallback
- Front page: `https://news.ycombinator.com/`
- Page N: `https://news.ycombinator.com/news?p=N`
- Comments: `https://news.ycombinator.com/item?id={id}`

## Gotchas
- API has no rate limit docs but be reasonable (~1 req/sec)
- Front page shows 30 stories per page
- Comment tree can be very deep -- limit recursion depth
