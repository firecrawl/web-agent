---
name: company-research
description: Research a company by extracting info from their website, funding data, team, tech stack, and recent news. Handles contact details, legal entities, and enrichment.
category: Investment & Finance
---

# Company Research

When researching a company:

## 1. Website Analysis — scrape systematically
- Start with the homepage. Then scrape these pages (if they exist):
  - /about, /about-us, /company
  - /team, /leadership, /people
  - /contact, /kontakt, /contacto (check localized variants)
  - /careers, /jobs
  - /pricing, /plans
  - /partners, /customers
- Extract: company name, legal entity name, tagline, description, founding year
- Look for business registration numbers (IČO, VAT, ABN, EIN) on contact/imprint pages
- Note office locations and physical addresses

## 2. Contact Details
- Extract ALL contact methods: email addresses, phone numbers, fax
- Check footer, contact page, and imprint/legal pages
- For multi-location companies, extract per-location contact details
- Look for specific department contacts (sales, support, press)

## 3. Funding and Financials
- Search for "[company] funding", "[company] crunchbase"
- Extract: total raised, latest round, investors, valuation if available
- Note revenue signals from press coverage or job postings

## 4. Team and Leadership
- Extract founders and C-suite from the team/about page
- Include: name, title, photo URL, bio if available
- For people enrichment tasks, also search LinkedIn

## 5. Products and Services
- Identify all products/services from the website
- Extract: product name, description, key features, pricing if shown
- Check /products, /services, /solutions pages
- Note integrations and tech partnerships

## 6. Social and Web Presence
- Extract from footer/header: LinkedIn, Twitter, Facebook, GitHub, blog URL
- LinkedIn URL must be in format: linkedin.com/company/...
- Blog URL should point to the actual blog index, not a single post

## 7. Output
- Match the provided schema exactly
- Include citation URLs for every data point where the schema has citation fields
- Use null for fields you genuinely cannot find — never guess
- Call formatOutput with the structured data
