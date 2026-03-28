---
name: content-generation
description: Generate content briefs and outlines by analyzing top-performing content on a topic across the web.
category: Content
---

# Content Generation

When generating a content brief or outline:

## 1. Topic Research
- Take the user's topic and search for the top 10 ranking articles
- Include query variations: "how to [topic]", "[topic] guide", "[topic] best practices"
- Note which content formats rank highest (listicles, guides, tutorials, comparisons)

## 2. Content Analysis
- Scrape the top 5 ranking articles with `onlyMainContent: true`
- Record the structure of each: heading hierarchy, section count, word count
- Extract common subtopics, key points, and calls to action
- Note use of images, tables, code blocks, or embedded media

## 3. Pattern Identification
- Identify headings and subtopics that appear across multiple top articles
- Determine the average and ideal word count for competitive content
- Note content gaps where no top article covers a relevant subtopic
- Identify the dominant content angle (beginner vs expert, conceptual vs practical)

## 4. Brief Assembly
- Produce a recommended outline with H2 and H3 headings
- Include target word count based on competitive analysis
- List key points to cover under each section
- Suggest content format, tone, and target audience

## 5. Output
- Deliver the content brief with outline, word count target, and key points
- Include source URLs for reference articles analyzed
- Use `formatOutput` with the user's preferred format
