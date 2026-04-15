# Firecrawl Agent

<img src=".internal/agent.jpg" alt="Firecrawl Agent" />

<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWhub2Jmd3NvejdhaTFsb3RvZWtpb2Q3cDVpN2pzYjVqeTgxdDEwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/CVyWVobjHwYGJiRz6r/giphy.gif" alt="Firecrawl Agent Demo" width="100%" />

When we built [Firecrawl's /agent endpoint](https://docs.firecrawl.dev/features/agent), the most common request was more control. People wanted to customize the agent, swap models, add their own skills, and build on top of the core primitives.

So we're open-sourcing the entire stack. One command scaffolds an agent at whatever level of abstraction you want to work with. Everything in this repo is yours to fork, extend, and deploy however you want.

Firecrawl's hosted [/agent](https://firecrawl.dev/app/agent) and [Spark 1](https://docs.firecrawl.dev/features/models) models are optimized for structured web research out of the box. This repo gives you full control over every layer.

## Hosted

> **[firecrawl.dev/app/agent](https://firecrawl.dev/app/agent)** - Powered by Firecrawl [Spark 1](https://docs.firecrawl.dev/features/models) models. No setup, no config, no API keys to manage. [Docs](https://docs.firecrawl.dev/features/agent)

## Open Source

Each layer builds on the one below it. Start at the top for a ready-to-use app, or go lower in the stack for finer control over the primitives.

| Layer | Description | Get started |
|:---:|---|---|
| [**Next.js Template**](./agent-templates/next/) | Chat UI, streaming, Skills, Subagents, structured output | `firecrawl-agent create -t next` |
| [**Express Template**](./agent-templates/express/) | API server with Skills, Subagents, structured output | `firecrawl-agent create -t express` |
| ↑ | | |
| [**Agent Core**](./agent-core/) | Orchestrator built on [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) (LangChain). Skills, Subagents, structured output | `firecrawl-agent create -t library` |
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
  competitor-analysis/
    SKILL.md          # procedure: compare 2+ products on pricing, features, positioning
  pricing-tracker/
    SKILL.md          # procedure: extract and normalize pricing tiers
  financial-research/
    SKILL.md          # procedure: 10-K/10-Q + analyst consensus for public companies
    sites/            # site playbooks auto-match URLs to the skill
      sec-gov.md
      yahoo-finance.md
  e-commerce/
    SKILL.md          # procedure: extract products, handle pagination
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

The agent combines web tools with an AI model in a loop — it plans, acts, observes, and repeats until the task is done. The harness is [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) (from LangChain), which gives us the plan-act loop, parallel `task` sub-agent spawning, and on-demand SKILL.md loading out of the box. Our `agent-core` wires Firecrawl's tools into that runtime and layers on structured output, scrapeBash sandboxing, and a thin streaming shim for UIs.

- **Harness** — [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) / LangGraph. Provides the agent loop, sub-agent spawning, skills loading, and context management.
- **Tools** — Search, Scrape, Interact (browser automation), scrapeBash (WASM sandbox). Powered by [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk).
- **Skills** — reusable SKILL.md playbooks. Auto-discovered from `agent-core/src/skills/definitions/`, loaded on demand via Deep Agents' skills middleware.
- **Subagents** — parallel workers for independent tasks, spawned via Deep Agents' `task` tool. Each has its own tool set and session state (e.g. an isolated interact browser session).
- **Output** — structured results via `formatOutput` (JSON, CSV) and data processing via `bashExec`.

## Project structure

| Directory | What's inside |
|-----------|--------------|
| [`agent-core/`](./agent-core/) | Core agent logic, orchestrator, Skills, tools |
| [`agent-templates/`](./agent-templates/) | Deployment templates - [Next.js](./agent-templates/next/), [Express](./agent-templates/express/), [Library](./agent-templates/library/) |

## License

MIT
