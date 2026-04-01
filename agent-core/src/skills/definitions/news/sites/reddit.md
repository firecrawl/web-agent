---
domains: ["reddit.com", "old.reddit.com", "www.reddit.com"]
platform: reddit
---

# Reddit Navigation

## URL Patterns
- Subreddit: `/r/{subreddit}`
- Sort: `/r/{subreddit}/top?t=day|week|month|year|all`
- Post: `/r/{subreddit}/comments/{post_id}/{slug}`
- User: `/user/{username}`
- Search: `/search?q={query}&type=link`

## JSON API (append .json to any URL)
- `/r/{subreddit}.json` -- listing
- `/r/{subreddit}/top.json?t=week&limit=100`
- `/r/{subreddit}/comments/{post_id}.json` -- post + comments

## Data Fields
- Posts: title, author, score, num_comments, url, selftext, created_utc, permalink
- Comments: author, body, score, created_utc, replies (nested)

## Pagination
- JSON API: use `after` parameter from response (`data.after`) for next page
- `limit` parameter: max 100 per request

## Gotchas
- old.reddit.com is easier to scrape than new Reddit
- Rate limit: ~60 req/min without auth
- Some subreddits are private or quarantined
- NSFW content filtered by default
