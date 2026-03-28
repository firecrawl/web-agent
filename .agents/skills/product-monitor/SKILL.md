---
name: product-monitor
description: Monitor product pages for price changes, stock availability, and new product launches across e-commerce sites.
category: Product & E-commerce
---

# Product Monitor

When monitoring product pages:

## 1. Target Identification
- Accept product URLs or search queries from the user
- If given search queries, use `search` to find product pages on target retailers
- Identify the canonical product page for each item

## 2. Product Data Extraction
- Scrape each product page to extract: name, price, currency, availability status
- Capture variant information: sizes, colors, configurations with individual prices
- Extract ratings, review counts, and seller/vendor details
- Use `interact` if pricing requires selecting options or dismissing modals

## 3. Multi-Retailer Comparison
- Search for the same product across multiple retailers
- Normalize product names and variants for cross-retailer matching
- Compare prices, shipping costs, and availability per retailer

## 4. Change Detection
- Compare extracted data against any baseline the user provides
- Flag price increases, price drops, and out-of-stock transitions
- Note new variants or listings that were not previously tracked

## 5. Output
- Produce structured product data with price, availability, and source URL per item
- Include a comparison summary highlighting the best price and availability
- Use `formatOutput` with the user's preferred format
