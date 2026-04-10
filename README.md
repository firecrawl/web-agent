# Firecrawl Agent

<img src=".internal/agent.jpg" alt="Firecrawl Agent" />

When we built [Firecrawl's /agent endpoint](https://docs.firecrawl.dev/features/agent), the most common request was more control. People wanted to customize the agent, swap models, add their own skills, and build on top of the core primitives.

So we're open-sourcing the entire stack. One command scaffolds an agent at whatever level of abstraction you want to work with. Everything in this repo is yours to fork, extend, and deploy however you want.

Firecrawl's hosted [/agent](https://firecrawl.dev/app/agent) and [Spark 1](https://docs.firecrawl.dev/features/models) models are optimized for structured web research out of the box. This repo gives you the same capabilities with full control over every layer.

## Hosted

> **[firecrawl.dev/app/agent](https://firecrawl.dev/app/agent)** - Powered by Firecrawl [Spark 1](https://docs.firecrawl.dev/features/models) models. No setup, no config, no API keys to manage. [Docs](https://docs.firecrawl.dev/features/agent)

## Open Source

Each layer builds on the one below it. Start at the top for a ready-to-use app, or go lower in the stack for finer control over the primitives.

| Layer | Description | Get started |
|:---:|---|---|
| [**Next.js Template**](./agent-templates/next/) | Chat UI, streaming, Skills, Subagents, structured output | `firecrawl-agent init -t next` |
| [**Express Template**](./agent-templates/express/) | API server with Skills, Subagents, structured output | `firecrawl-agent init -t express` |
| ↑ | | |
| [**Agent Core**](./agent-core/) | Orchestrator, Skills, Subagents, structured output | `firecrawl-agent init -t library` |
| ↑ | | |
| [**Firecrawl AI SDK**](https://npmjs.com/package/firecrawl-aisdk) | Search, Scrape, Interact as Vercel AI SDK tools | `npm i firecrawl-aisdk` |
| ↑ | | |
| [**Firecrawl SDK**](https://npmjs.com/package/firecrawl) | Core API client for Scrape, Search, Crawl, Extract | `npm i firecrawl` |
| ↑ | | |
| [**API Reference**](https://docs.firecrawl.dev/api-reference/v2-introduction) | REST API, use from any language | [docs.firecrawl.dev](https://docs.firecrawl.dev) |

### Examples

| Level | Examples |
|---|---|
| Next.js | [Full template](./agent-templates/next/) |
| Express | [API server](./agent-templates/express/) |
| Agent Core | [Basic](./agent-core/examples/1-basic.ts) · [Structured output](./agent-core/examples/2-structured-output.ts) · [Parallel Subagents](./agent-core/examples/3-parallel-subagents.ts) · [With Skills](./agent-core/examples/4-with-skills.ts) · [Streaming](./agent-core/examples/5-streaming.ts) |
| Firecrawl AI SDK | [npmjs.com/package/firecrawl-aisdk](https://npmjs.com/package/firecrawl-aisdk) |

## Skills

Skills are reusable SKILL.md files that teach the agent domain-specific procedures. Drop a folder into `agent-core/src/skills/definitions/` and it's auto-discovered at startup.

```
agent-core/src/skills/definitions/
  e-commerce/
    SKILL.md          # procedure: how to Extract products, handle pagination
  deep-research/
    SKILL.md          # procedure: multi-source research with fact-checking
  structured-extraction/
    SKILL.md          # procedure: schema-driven extraction with validation
```

Each SKILL.md has frontmatter and a procedure:

```markdown
---
name: e-commerce
description: Extract products, pricing, and inventory from e-commerce sites.
category: E-commerce
---

# E-commerce Extraction

## General Patterns
- Check for sitemap.xml first
- Look for /products.json or API endpoints before scraping HTML
- Always check total count vs extracted count

## Pagination
- Check for next/prev links, page numbers, "showing X of Y"
- Keep going until you have all the data
```

The agent loads Skills on demand via the `load_skill` tool. You can also pass `skills: ["e-commerce"]` in the run params to pre-load specific Skills.

## How it works

The agent combines web tools with an AI model in a loop - it plans, acts, observes, and repeats until the task is done.

- **Tools** - Search, Scrape, Interact (browser automation). Powered by [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk).
- **Skills** - reusable SKILL.md playbooks. Auto-discovered from `agent-core/src/skills/definitions/`.
- **Subagents** - parallel workers for independent tasks. The orchestrator spawns them dynamically.
- **Output** - structured results via `formatOutput` (JSON, CSV, Markdown) and data processing via `bashExec`.

## Project structure

| Directory | What's inside |
|-----------|--------------|
| [`agent-core/`](./agent-core/) | Core agent logic, orchestrator, Skills, tools |
| [`agent-templates/`](./agent-templates/) | Deployment templates - [Next.js](./agent-templates/next/), [Express](./agent-templates/express/), [Library](./agent-templates/library/) |

## License

MIT
