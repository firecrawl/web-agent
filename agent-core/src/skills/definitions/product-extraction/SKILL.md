---
name: product-extraction
description: Extract product details from e-commerce sites including specs, pricing, materials, sizing, and images. Handles product variants and technical specifications.
category: Research
---

# Product Extraction

Use this skill for extracting detailed product information from e-commerce and retail sites.

## Strategy
1. Scrape the product page with formats: ["markdown"] to see all available data.
2. Look for: product name, price, description, images, specs, materials, sizing.
3. For variant products (colors, sizes), extract all available variants.
4. Check for additional tabs/sections (reviews, specs, materials) that may need interact to reveal.

## Key data points
- **Name and brand**: Product title and manufacturer/brand
- **Pricing**: Current price, original price, currency. Extract as numbers.
- **Description**: Full product description, not truncated
- **Materials/composition**: Fabric content, materials list with percentages
- **Sizing**: Available sizes, size chart if present
- **Colors/variants**: All available options with their specific details
- **Images**: Product image URLs (main image and gallery)
- **Technical specs**: Weight, dimensions, care instructions
- **SKU/identifiers**: Product ID, SKU, barcode if visible

## E-commerce specifics
- Prices must be numbers (29.99 not "$29.99")
- For "techpack" style requests, focus on: materials, construction details, dimensions, weight, colorways
- If the page has a size chart, extract it as structured data
- Product URLs often contain variant parameters — note which variant you're extracting

## Output
- Match the schema exactly
- Use null for genuinely unavailable fields
- Call formatOutput with the structured data
