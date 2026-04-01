---
domains: ["myshopify.com", "shopify.com"]
platform: shopify
---

# Shopify Store Navigation

## API Endpoints (no auth required on most stores)
- All products: `/products.json` (paginate with `?page=N`, max 250 per page via `?limit=250`)
- Single product: `/products/{handle}.json`
- Collections list: `/collections.json`
- Collection products: `/collections/{handle}/products.json`
- Search: `/search/suggest.json?q={query}&resources[type]=product`

## URL Patterns
- Product pages: `/products/{handle}`
- Collection pages: `/collections/{handle}`
- Filtered collections: `/collections/{handle}/{tag}`
- Pages: `/pages/{handle}`

## Detection
- Look for `Shopify.theme` or `cdn.shopify.com` in page source
- Meta tag: `<meta name="shopify-checkout-api-token"`

## Pagination
- JSON API: increment `?page=N` until empty array returned
- HTML: look for `?page=N` links or "Previous/Next" navigation

## Product Variants
- Included in product JSON under `variants` array
- Each variant has: id, title, price, compare_at_price, sku, available, option1/option2/option3
- Images mapped via `variant.image_id` to product `images` array

## Images
- Hosted on `cdn.shopify.com`
- Resize: append `_200x200`, `_400x400`, `_1024x1024` before extension
- Original: `_original` or no suffix

## Gotchas
- Some stores password-protect: check for `/password` page
- Rate limiting: ~2 req/sec on JSON API
- Product metafields not exposed in default JSON API
