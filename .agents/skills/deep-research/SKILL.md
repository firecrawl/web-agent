---
name: deep-research
description: Conduct deep multi-source research on a topic with source triangulation, fact-checking, and comprehensive synthesis.
category: Research
---

# Deep Research

When conducting deep research on a topic:

## 1. Query Formulation
- Break the topic into 4-6 distinct angles or subtopics
- Formulate 2-3 search queries per angle using different terminology
- Include academic, industry, and news-oriented query variations

## 2. Broad Source Collection
- Use `search` across all query variations to gather 10+ unique sources
- Prioritize primary sources: official reports, research papers, authoritative publications
- Include contrarian or minority viewpoints to avoid confirmation bias

## 3. Deep Extraction
- Scrape each source with `onlyMainContent: true`
- Extract key claims, data points, dates, and attributed quotes
- Record the author, publication, and date for every source

## 4. Cross-Reference and Fact-Check
- Compare claims across sources to identify consensus and contradictions
- Flag claims supported by only a single source
- Note where sources disagree and assess which has stronger evidence
- Assign confidence levels: high (3+ corroborating sources), medium (2), low (1)

## 5. Synthesis
- Build a structured knowledge map organized by subtopic
- Summarize findings with inline source citations
- Highlight areas of strong consensus vs active debate
- Use `formatOutput` with the user's preferred format
