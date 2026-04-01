---
name: price-tracker
description: Extract and compare pricing information from product and SaaS websites, including plan tiers, features per plan, and cost calculations.
category: Product & E-commerce
---

# Price Tracker

When extracting and comparing pricing:

## 1. Target Identification
- Accept a list of product URLs or names to compare
- If given names, search for "[product] pricing" to find pricing pages
- Identify the canonical pricing page for each product

## 2. Pricing Extraction
- Scrape each pricing page with structured extraction
- Use `interact` if pricing requires toggling between monthly/annual or different tiers
- Extract: plan name, price, billing period, currency
- Note free tiers, trials, and custom/enterprise pricing

## 3. Feature Mapping
- Build a unified feature list across all products
- For each product, map which features are included in which plan
- Note feature limits (users, storage, API calls, etc.)
- Identify add-ons or usage-based pricing components

## 4. Cost Calculation
- Calculate annual cost for each plan
- If the user specifies usage (e.g., 10 users, 50k API calls), compute total cost
- Factor in overage charges or usage-based pricing
- Highlight the best value option for the given requirements

## 5. Output
- Use `formatOutput` with JSON for structured pricing data
- For CSV: one row per plan, columns for price, features, limits
- Include a recommendation summary based on value analysis
- Always note the date pricing was captured
