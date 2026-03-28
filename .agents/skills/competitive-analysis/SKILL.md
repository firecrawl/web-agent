---
name: competitive-analysis
description: Analyze competitors by extracting pricing, features, and positioning from their websites.
category: Competitive Intelligence
---

# Competitive Analysis

When performing competitive analysis:

## 1. Identify Competitors
- If the user provides competitor names/URLs, use those directly
- Otherwise, search for "[product category] alternatives" or "[product] competitors"
- Focus on the top 3-5 most relevant competitors

## 2. Pricing Extraction
- Navigate to each competitor's pricing page (usually /pricing, /plans, or /packages)
- Extract: plan names, prices, billing periods, feature lists per plan
- Note any enterprise/custom pricing tiers
- Check for annual vs monthly pricing differences

## 3. Feature Comparison
- Identify the core features the user cares about
- Build a feature matrix: rows = features, columns = competitors
- Use boolean (has/doesn't have) or detail values
- Note feature limits (e.g., "up to 10 users" vs "unlimited")

## 4. Positioning
- Extract taglines, hero text, and value propositions from homepages
- Note target audience signals (enterprise, SMB, developer, etc.)
- Identify unique selling points per competitor

## 5. Output
- Use `formatOutput` with format "json" for structured comparison data
- Structure as: `{ competitors: [{ name, url, pricing: [...], features: {...}, positioning: {...} }] }`
- Include a summary comparison table if CSV format is requested
