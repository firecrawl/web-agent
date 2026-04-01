---
name: e-commerce
description: Navigate e-commerce sites to extract products, pricing, categories, and inventory. Handles pagination, variants, and JS-heavy storefronts.
category: E-commerce
---

# E-commerce Extraction

## General Patterns
- Check for sitemap.xml first -- many stores list all product URLs
- Look for /products.json, /api/products, or similar API endpoints before scraping HTML
- Product listing pages usually paginate: look for ?page=N, ?offset=N, or "Load more" buttons
- Always check the total count shown on the page vs what you've extracted

## Product Data Checklist
- Name, brand, SKU/ID
- Price (current, original/compare-at, currency)
- Variants (size, color, etc.) with per-variant pricing and availability
- Images (primary + gallery)
- Description (short + long)
- Category/breadcrumb path
- Availability/stock status
- Ratings and review count

## Pagination
- Check for: next/prev links, page numbers, "showing X of Y" text
- For infinite scroll: use interact to scroll and load more
- Keep count: if page says "200 products" and you have 24, keep going

## JS-Heavy Sites
- Use interact for sites that require JavaScript rendering
- Look for XHR/API calls in the page that return JSON -- often easier than parsing HTML
- Single-page apps often have internal APIs at predictable paths

## Site-specific playbooks are in the sites/ directory
