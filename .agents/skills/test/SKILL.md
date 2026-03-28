---
name: test
description: How to scrape and compare pricing and feature tables from Vercel and Netlify
---

# Scraping & Comparing Vercel vs. Netlify Pricing Pages

## What This Skill Teaches
This skill covers how to navigate the Vercel and Netlify pricing pages, extract plan and pricing data, interact with feature comparison tables, and structure the results into a side-by-side breakdown. It includes how the data is organized on each site, what sections require attention, and how to handle differences in pricing models (credit-based vs. flat-rate) when synthesizing a unified comparison.

## Where to Find the Data

- **Vercel Pricing:** `https://vercel.com/pricing`
  - Single-page layout with plan cards at the top and a detailed feature comparison table below
  - Feature table is organized by category (Build, Functions, Security, Observability, etc.)
  - Add-on pricing scattered throughout table rows (not always in a separate section)

- **Netlify Pricing:** `https://www.netlify.com/pricing/`
  - Single-page layout with plan cards and a feature comparison table
  - Uses a credit-based pricing model; bandwidth/compute expressed in credits rather than raw GB/requests
  - Some features listed as Enterprise-only are visually de-emphasized

## Step-by-Step Process

1. Navigate to `https://vercel.com/pricing` and capture the full page content including the plan cards (plan names, monthly costs, seat costs, included credits/limits) at the top.
2. Scroll down to the feature comparison table on the Vercel page. The table is divided into collapsible or sectioned categories — expand all sections to ensure no rows are hidden.
3. Record each feature row noting the value per plan tier (Hobby, Pro, Enterprise). Note add-on pricing inline where present.
4. Navigate to `https://www.netlify.com/pricing/` and repeat: capture plan cards (Free, Personal, Pro, Enterprise), their costs, and seat pricing.
5. Scroll to and fully expand the Netlify feature comparison table. Note that some rows use checkmarks, some use text values, and some say "Contact us" for Enterprise.
6. For each platform, translate credit-based limits into approximate real-world equivalents (e.g., Netlify credits → GB bandwidth) for apples-to-apples comparison.
7. Organize extracted data into shared categories that exist on both platforms: Pricing, Build & Deploy, CDN & Networking, Compute & Functions, Security & Compliance, Observability, Collaboration, AI Features, and Support.
8. Build a side-by-side table for each category, aligning equivalent features across both platforms. Where a feature exists on one platform but not the other, note "No" or "Not offered."
9. Add a summary verdict table highlighting which platform leads in each dimension.

## Data Structure

For each platform, extract:

- **Plan name** — e.g., Hobby, Pro, Enterprise / Free, Personal, Pro, Enterprise
- **Base price** — monthly cost per plan
- **Seat cost** — additional per-seat charge (if any)
- **Included usage** — bandwidth (GB), requests, build minutes, function invocations
- **Overage model** — pay-as-you-go, credit recharge, hard cap, or blocked
- **Per-category feature rows** — feature name → value per tier (boolean, numeric limit, or descriptive)
- **Add-on pricing** — optional upgrades listed inline (e.g., SAML SSO, log retention, static IPs)

## Gotchas & Edge Cases

- **Netlify uses credits, not raw units:** Bandwidth, functions, and builds are all denominated in credits. Conversion rates are documented on the page (e.g., 1 GB bandwidth = ~10 credits). Always convert before comparing to Vercel's GB-based limits.
- **Vercel's "Pro" plan is both a solo and team plan:** The base $20 covers one seat; additional seats are $20 each. This can be confused with Netlify's Personal ($9/seat) vs. Pro ($20/seat) distinction.
- **Feature table rows may be collapsed by default:** On both sites, some feature categories are collapsed or require scrolling past a fold. Ensure the full table is rendered before extracting.
- **Add-ons vs. included features:** Both platforms list features that appear in the comparison table but are actually paid add-ons (e.g., Vercel's Advanced Deployment Protection at $150/mo, SAML SSO at $300/mo). These are not included in the base plan price.
- **Enterprise rows are often vague:** Both platforms use "Contact us" or "Custom" for Enterprise features. Don't treat these as equivalent — note them separately rather than merging.
- **Vercel Fluid Compute** is a distinct compute model not present on Netlify — avoid trying to map it to a Netlify equivalent.
- **Netlify Background Functions** have no direct Vercel equivalent on standard plans — note as a Netlify-only feature.

## Verification

- Cross-check plan prices against each platform's billing or FAQ pages to confirm current pricing (pricing pages can lag promotions or recent changes).
- Verify that seat pricing is correctly distinguished from base plan pricing — a common source of error in comparison tables.
- Confirm credit conversion rates by checking Netlify's "How credits work" documentation linked from the pricing page.
- Spot-check 3–5 specific features (e.g., concurrent builds, log retention, WAF rules) against each platform's documentation pages to ensure the comparison table values match official docs.
- If any row shows a significant discrepancy (e.g., Netlify offering far more than Vercel on a key feature), re-verify against the source before including.

## Example Tasks

- "Scrape Vercel and Netlify pricing pages and return a side-by-side feature comparison table"
- "What are the differences between Vercel Pro and Netlify Pro?"
- "Compare the free tiers of Vercel and Netlify including bandwidth, build minutes, and function limits"
- "Which platform has better security features at the Pro tier — Vercel or Netlify?"
- "Extract all add-on pricing from both Vercel and Netlify pricing pages"