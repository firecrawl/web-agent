---
name: company-research
description: Research a company by extracting info from their website, funding data, team, tech stack, and recent news.
category: Investment & Finance
---

# Company Research

When researching a company:

## 1. Website Analysis
- Scrape the company homepage, /about, /team, and /careers pages
- Extract: tagline, mission statement, product description, founding year
- Identify target market and customer segments from messaging
- Note office locations and team size indicators

## 2. Funding and Financials
- Search for "[company] funding", "[company] series", "[company] acquisition"
- Check Crunchbase, PitchBook, or press releases for funding rounds
- Extract: total raised, latest round, investors, valuation if available
- Note revenue signals from job postings or press coverage

## 3. Team and Leadership
- Extract founders and C-suite from the team or about page
- Search for key executives on LinkedIn for background context
- Note recent hires or departures in leadership roles

## 4. Tech Stack and Product
- Check /careers or job postings for technology mentions
- Look for integration pages, API docs, or developer portals
- Identify the core product offering and pricing model
- Note key partnerships or integrations

## 5. Output
- Produce a structured company profile with all extracted data points
- Include source URLs for every claim
- Use `formatOutput` with the user's preferred format
