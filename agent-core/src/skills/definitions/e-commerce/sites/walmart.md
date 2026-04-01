---
domains: ["walmart.com"]
platform: walmart
---

# Walmart Navigation

## URL Patterns
- Product: `/ip/{product-name}/{product-id}`
- Search: `/search?q={query}`
- Category: `/browse/{category-name}/{category-id}`
- Store finder: `/store/finder`

## Key Data Points
- Product ID in URL (numeric)
- Price: current price, was price, price per unit
- Fulfillment: delivery, pickup, shipping options
- Seller: "Sold & shipped by Walmart" vs marketplace sellers

## Pagination
- Search: `&page=N`, typically 40 results per page
- Category pages: same pattern

## Gotchas
- Heavy JavaScript rendering -- may need interact
- Location-based pricing and availability
- Some products show "Add to cart to see price"
