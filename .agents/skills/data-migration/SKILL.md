---
name: data-migration
description: Extract and restructure web content for migration between platforms, CMSes, or databases.
category: Data Migration
---

# Data Migration

When extracting content for platform migration:

## 1. Source Site Mapping
- Use `map` to discover all content pages on the source site
- Categorize pages by type: posts, pages, products, categories, tags
- Build a complete inventory with URL, type, and hierarchy

## 2. Content Extraction
- Scrape each content page with `onlyMainContent: true`
- Extract structured fields: title, body, author, publish date, categories, tags
- Capture featured images and inline media URLs
- Preserve internal link relationships between pages

## 3. Metadata Collection
- Extract SEO metadata: meta title, description, canonical URL, Open Graph tags
- Capture URL slugs and redirect mappings
- Note custom fields, taxonomies, or content attributes specific to the source CMS

## 4. Normalization
- Map source content types to the target platform's schema
- Normalize dates, categories, and tags to target format conventions
- Resolve relative URLs to absolute paths for media assets
- Flag content that does not map cleanly to the target structure

## 5. Output
- Produce migration-ready data in the target format (JSON, CSV, or XML)
- Include a migration manifest listing all pages with status and mapped fields
- Note any items requiring manual review or intervention
- Use `formatOutput` with the user's preferred format
