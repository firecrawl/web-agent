---
name: lead-enrichment
description: Enrich a list of companies or people by finding their websites, social profiles, descriptions, funding info, and key details from the web.
category: Lead Enrichment
---

# Lead Enrichment

When enriching leads with web data:

## 1. Input Parsing
- Accept a list of company names, domains, or person names
- If given a CSV or JSON, parse it and identify the lookup field
- Normalize names: trim whitespace, handle variations

## 2. Discovery
- For each lead, search for their official website and key profiles
- Check LinkedIn company pages, Crunchbase, and official sites
- For people, find their role, company, and public profiles

## 3. Data Collection
- Scrape each company homepage for: tagline, description, industry
- Check /about, /team, or /company pages for team size and location
- Look for pricing pages to determine business model
- Search for recent funding announcements or press releases

## 4. Enrichment Fields
- Company: name, domain, description, industry, location, team size, funding, tech stack
- Person: name, title, company, location, social links
- Always include the source URL for each data point

## 5. Output
- Use `formatOutput` with CSV for spreadsheet-ready data
- Use JSON with a consistent schema across all leads
- Flag any leads that could not be found or had incomplete data
