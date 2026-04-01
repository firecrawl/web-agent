---
domains: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.co.jp", "amazon.ca"]
platform: amazon
---

# Amazon Navigation

## URL Patterns
- Product page: `/dp/{ASIN}` or `/gp/product/{ASIN}`
- Search results: `/s?k={query}`
- Category: `/b?node={category_id}`
- Best sellers: `/gp/bestsellers/{category}`
- Reviews: `/product-reviews/{ASIN}`

## Key Data Points
- ASIN is the unique product identifier (10 chars, starts with B0 usually)
- Price can be in multiple locations: `#priceblock_ourprice`, `.a-price .a-offscreen`
- "Buy Box" price vs other sellers
- Star rating and review count near title
- Feature bullets in `#feature-bullets`

## Pagination
- Search results: `&page=N` parameter
- Reviews: `&pageNumber=N`
- Usually 16-48 results per search page

## Gotchas
- Heavy bot detection -- use scrape with default settings, don't add custom headers
- Prices vary by location/account
- Some content loads via AJAX (reviews, Q&A)
- Product variations (size/color) are separate ASINs linked via parent ASIN
