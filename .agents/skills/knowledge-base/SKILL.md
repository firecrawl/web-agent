---
name: knowledge-base
description: Build a local knowledge base by systematically scraping, organizing, and indexing content from documentation sites, wikis, or any collection of web pages.
category: Research
---

# Knowledge Base Builder

When building a knowledge base from web sources:

## 1. Source Mapping
- Use `map` to discover all pages under the target domain or path
- Filter URLs to only include relevant content (docs, guides, reference)
- Exclude navigation pages, changelogs, and non-content URLs
- Group pages by section or topic based on URL structure

## 2. Systematic Extraction
- Scrape pages in batches, starting from top-level overview pages
- Use `scrape` with `onlyMainContent: true` to strip nav/footer chrome
- For each page extract: title, content, URL, section hierarchy
- Track which pages have been processed to avoid duplicates

## 3. Organization
- Use bash to create a folder structure mirroring the site hierarchy
- Save each page's content as a separate file under /data/
- Build an index file listing all pages with titles and paths
- Create a table of contents from the section hierarchy

## 4. Cross-referencing
- Identify key concepts and terms that appear across multiple pages
- Build a glossary of important terms with definitions
- Note internal links between pages to preserve relationships

## 5. Output
- Save the full knowledge base to /data/ as organized files
- Generate a summary index with page count, sections, and key topics
- Use `formatOutput` with JSON for structured index, markdown for readable output
