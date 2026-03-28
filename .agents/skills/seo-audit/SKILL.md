---
name: seo-audit
description: Audit a website's SEO by checking meta tags, headings, page speed indicators, broken links, and content structure.
category: SEO
---

# SEO Audit

When auditing a website's SEO:

## 1. Site Discovery
- Use `map` to discover all pages on the target domain
- Identify key page types: homepage, product pages, blog posts, landing pages
- Note the total page count and URL structure patterns

## 2. Meta Tag Analysis
- Scrape each key page and extract meta titles, meta descriptions, and canonical tags
- Flag pages with missing or duplicate meta titles
- Check title length (50-60 chars) and description length (150-160 chars)
- Verify canonical tags point to the correct URLs

## 3. Heading and Content Structure
- Extract H1, H2, and H3 tags from each page
- Flag pages with missing or multiple H1 tags
- Check for logical heading hierarchy (H1 > H2 > H3)
- Identify pages with thin content (under 300 words)

## 4. Image and Link Checks
- Find images missing alt text attributes
- Use `map` to detect broken internal links (404s)
- Check for orphan pages with no internal links pointing to them
- Verify external links are not broken

## 5. Output
- Produce a prioritized list of issues sorted by severity (critical, warning, info)
- Include the affected URL, issue type, and recommended fix for each item
- Use `formatOutput` with the user's preferred format
