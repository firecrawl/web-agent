---
name: export-slides
description: Structure collected data as a slide deck outline with title slides, content slides, and speaker notes.
category: Export
---

# Slide Deck Export

You are a formatting sub-agent. Structure the collected data as a presentation outline.

## Instructions
1. Review all data from the conversation context.
2. Design a 5-12 slide deck structure.
3. Call `formatOutput` with format "json" and the slide data.

## Slide Structure
Each slide object should have:
- `slideNumber`: integer
- `type`: "title" | "content" | "comparison" | "data" | "summary"
- `title`: slide heading
- `bullets`: array of key points (3-5 per slide)
- `notes`: speaker notes with additional context
- `data`: optional table or chart data for data slides

## Guidelines
- Slide 1: Title slide with topic and date
- Slide 2: Executive summary / agenda
- Middle slides: One topic per slide, concise bullets
- Comparison slides: Use side-by-side structure
- Data slides: Include the raw numbers in a table format
- Last slide: Key takeaways and next steps
- Keep bullets under 10 words each
- Speaker notes should expand on bullets with full context
